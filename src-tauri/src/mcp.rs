//! 本机 MCP Server：Streamable HTTP + stdio，默认关闭；只读工具直接访问存储，写入工具经主窗口确认。
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::extract::{Request, State};
use axum::http::{HeaderMap, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::any;
use axum::Router;
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use rmcp::handler::server::ServerHandler;
use rmcp::model::{
    CallToolRequestParams, CallToolResponse, CallToolResult, ContentBlock, Implementation,
    JsonObject, ListToolsResult, PaginatedRequestParams, ServerCapabilities, ServerConfig, Tool,
};
use rmcp::service::RequestContext;
use rmcp::transport::streamable_http_server::session::local::LocalSessionManager;
use rmcp::transport::streamable_http_server::tower::{
    StreamableHttpServerConfig, StreamableHttpService,
};
use rmcp::transport::stdio;
use rmcp::{ErrorData as McpError, RoleServer, ServiceExt};
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::sync::{oneshot, Mutex as AsyncMutex};

use crate::storage::{FileMeta, Storage, StorageState, TASKS};

pub const DEFAULT_PORT: u16 = 7331;
const MAX_REQUESTS_PER_MINUTE: usize = 60;
const WRITE_TIMEOUT: Duration = Duration::from_secs(60);
const CONFIG_KEY: &str = "mcp-config";
const TOKEN_KEY: &str = "mcp-token";
const AUDIT_LIMIT: usize = 50;

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default)]
    pub write_enabled: bool,
}

fn default_port() -> u16 {
    DEFAULT_PORT
}

impl Default for McpConfig {
    fn default() -> Self {
        Self { enabled: false, port: DEFAULT_PORT, write_enabled: false }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpAuditEntry {
    pub tool: String,
    pub at: i64,
    pub elapsed_ms: u128,
    pub ok: bool,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStatus {
    pub enabled: bool,
    pub running: bool,
    pub port: u16,
    pub write_enabled: bool,
    pub token: String,
    pub error: Option<String>,
}

struct PendingWrite {
    sender: oneshot::Sender<WriteDecision>,
}

struct WriteDecision {
    approved: bool,
    result: Option<Value>,
    error: Option<String>,
}

struct Shared {
    token: Mutex<String>,
    write_enabled: AtomicBool,
    audit: Mutex<VecDeque<McpAuditEntry>>,
    pending: Mutex<HashMap<String, PendingWrite>>,
    rate: Mutex<VecDeque<Instant>>,
    app: Option<AppHandle>,
}

impl Shared {
    fn push_audit(&self, tool: &str, at: i64, started: Instant, ok: bool, detail: &str) {
        let entry = McpAuditEntry {
            tool: tool.to_string(),
            at,
            elapsed_ms: started.elapsed().as_millis(),
            ok,
            detail: detail.to_string(),
        };
        let mut audit = self.audit.lock().unwrap();
        audit.push_front(entry);
        audit.truncate(AUDIT_LIMIT);
    }
}

struct RunningServer {
    shutdown: Option<oneshot::Sender<()>>,
    task: Option<tauri::async_runtime::JoinHandle<()>>,
    port: Option<u16>,
    error: Option<String>,
}

pub struct McpRuntimeState {
    shared: Arc<Shared>,
    running: AsyncMutex<RunningServer>,
    config: Mutex<McpConfig>,
    storage: Option<Arc<Storage>>,
}

#[derive(Clone)]
struct McpServer {
    storage: Arc<Storage>,
    shared: Arc<Shared>,
}

impl McpServer {
    fn kv_value(&self, key: &str) -> Option<Value> {
        let kv = self.storage.kv_get_all().ok()?;
        serde_json::from_str(kv.get(key)?).ok()
    }

    fn settings_value(&self) -> Option<Value> {
        let root = self.kv_value("gpt-image-playground")?;
        root.get("state").and_then(|state| state.get("settings")).cloned()
    }

    fn workspace_value(&self) -> Option<Value> {
        let root = self.kv_value("panpan-workspace-v1")?;
        root.get("state").cloned()
    }

    fn tasks(&self) -> Vec<Value> {
        let raw = match self.storage.docs_get_all(TASKS) {
            Ok(raw) => raw,
            Err(_) => return Vec::new(),
        };
        let mut tasks: Vec<Value> = serde_json::from_str(&raw).unwrap_or_default();
        tasks.sort_by(|a, b| {
            b.get("createdAt").and_then(Value::as_i64).unwrap_or(0)
                .cmp(&a.get("createdAt").and_then(Value::as_i64).unwrap_or(0))
        });
        tasks.into_iter().map(sanitize_task).collect()
    }

    async fn write_request(&self, tool: &str, args: &JsonObject) -> Result<Value, String> {
        let Some(app) = self.shared.app.as_ref() else {
            return Err("stdio 不支持写入".to_string());
        };
        if !self.shared.write_enabled.load(Ordering::Relaxed) {
            return Err("写入工具未开启".to_string());
        }
        let id = random_id();
        let (sender, receiver) = oneshot::channel();
        self.shared.pending.lock().unwrap().insert(id.clone(), PendingWrite { sender });
        let payload = write_request_payload(&id, tool, args);
        if app.emit("mcp-write-request", payload).is_err() {
            self.shared.pending.lock().unwrap().remove(&id);
            return Err("无法通知主窗口确认".to_string());
        }
        match tokio::time::timeout(WRITE_TIMEOUT, receiver).await {
            Ok(Ok(decision)) if decision.approved => {
                decision.result.ok_or_else(|| "写入没有返回结果".to_string())
            }
            Ok(Ok(decision)) => Err(decision.error.unwrap_or_else(|| "用户拒绝".to_string())),
            Ok(Err(_)) => Err("写入确认通道已关闭".to_string()),
            Err(_) => {
                self.shared.pending.lock().unwrap().remove(&id);
                Err("写入确认超时".to_string())
            }
        }
    }
}

fn random_id() -> String {
    let mut bytes = [0u8; 16];
    if getrandom::fill(&mut bytes).is_err() {
        bytes = [0u8; 16];
    }
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn write_request_payload(id: &str, tool: &str, args: &JsonObject) -> Value {
    json!({
        "id": id,
        "tool": tool,
        "prompt": args.get("prompt").and_then(Value::as_str).unwrap_or(""),
        "imageIds": args.get("imageIds").cloned().unwrap_or(Value::Array(vec![])),
        "canvasId": args.get("canvasId").and_then(Value::as_str),
        "projectId": args.get("projectId").and_then(Value::as_str),
    })
}

fn sanitize_task(task: Value) -> Value {
    let Some(obj) = task.as_object() else { return Value::Null };
    let failed = obj.get("status").and_then(Value::as_str) == Some("error");
    json!({
        "id": obj.get("id").cloned().unwrap_or(Value::Null),
        "prompt": obj.get("prompt").cloned().unwrap_or(Value::Null),
        "status": obj.get("status").cloned().unwrap_or(Value::Null),
        "createdAt": obj.get("createdAt").cloned().unwrap_or(Value::Null),
        "finishedAt": obj.get("finishedAt").cloned().unwrap_or(Value::Null),
        "elapsed": obj.get("elapsed").cloned().unwrap_or(Value::Null),
        "projectId": obj.get("projectId").cloned().unwrap_or(Value::Null),
        "canvasId": obj.get("canvasId").cloned().unwrap_or(Value::Null),
        "inputImageIds": obj.get("inputImageIds").cloned().unwrap_or(Value::Array(vec![])),
        "outputImages": obj.get("outputImages").cloned().unwrap_or(Value::Array(vec![])),
        "params": obj.get("params").cloned().unwrap_or(Value::Null),
        "apiModel": obj.get("apiModel").cloned().unwrap_or(Value::Null),
        "error": if failed { Value::String("生成失败".into()) } else { Value::Null },
    })
}

fn schema(value: Value) -> Arc<JsonObject> {
    Arc::new(value.as_object().cloned().unwrap_or_default())
}

fn tools() -> Vec<Tool> {
    vec![
        Tool::new("project.list", "列出项目", schema(json!({"type":"object","properties":{}}))),
        Tool::new("canvas.list", "列出画布", schema(json!({"type":"object","properties":{"projectId":{"type":"string"}}}))),
        Tool::new("task.list", "分页列出任务", schema(json!({"type":"object","properties":{"limit":{"type":"integer","minimum":1,"maximum":200},"offset":{"type":"integer","minimum":0},"projectId":{"type":"string"},"canvasId":{"type":"string"}}}))),
        Tool::new("task.get", "读取单个任务", schema(json!({"type":"object","required":["id"],"properties":{"id":{"type":"string"}}}))),
        Tool::new("image.get", "读取图片内容", schema(json!({"type":"object","required":["id"],"properties":{"id":{"type":"string"}}}))),
        Tool::new("settings.get", "读取脱敏设置", schema(json!({"type":"object","properties":{}}))),
        Tool::new("task.create", "创建生成任务（默认关闭，需 UI 确认）", schema(json!({"type":"object","required":["prompt"],"properties":{"prompt":{"type":"string"},"imageIds":{"type":"array","items":{"type":"string"}},"projectId":{"type":"string"},"canvasId":{"type":"string"}}}))),
        Tool::new("image.attach", "把图库图片加入当前参考图（默认关闭，需 UI 确认）", schema(json!({"type":"object","required":["imageIds"],"properties":{"imageIds":{"type":"array","items":{"type":"string"}}}}))),
    ]
}

fn text_result(value: Value) -> CallToolResponse {
    CallToolResult::success(vec![ContentBlock::json(value).unwrap_or_else(|_| ContentBlock::text("{}"))]).into()
}

fn error_result(message: &str) -> CallToolResponse {
    CallToolResult::error(vec![ContentBlock::text(message)]).into()
}

fn host_only(base_url: &str) -> String {
    url::Url::parse(base_url).ok().and_then(|url| url.host_str().map(str::to_string)).unwrap_or_default()
}

impl ServerHandler for McpServer {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("panpan-workbench", env!("CARGO_PKG_VERSION")))
            .with_instructions("盼盼工作台本机 MCP；只读工具直接可用，写入工具默认关闭且必须由主窗口确认。")
    }

    async fn list_tools(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListToolsResult, McpError> {
        let mut list = tools();
        if self.shared.app.is_none() {
            list.retain(|tool| tool.name.as_ref() != "task.create" && tool.name.as_ref() != "image.attach");
        }
        Ok(ListToolsResult::with_all_items(list))
    }

    async fn call_tool(
        &self,
        request: CallToolRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> Result<CallToolResponse, McpError> {
        let started = Instant::now();
        let at = crate::storage::now_ms();
        let name = request.name.to_string();
        let args = request.arguments.unwrap_or_default();
        let result = match name.as_str() {
            "project.list" => self
                .workspace_value()
                .and_then(|state| state.get("projects").cloned())
                .map(text_result)
                .unwrap_or_else(|| error_result("没有项目数据")),
            "canvas.list" => {
                let project = args.get("projectId").and_then(Value::as_str);
                let canvases = self
                    .workspace_value()
                    .and_then(|state| state.get("canvases").cloned())
                    .and_then(|value| value.as_array().cloned())
                    .unwrap_or_default()
                    .into_iter()
                    .filter(|canvas| {
                        project.is_none_or(|project| canvas.get("projectId").and_then(Value::as_str) == Some(project))
                    })
                    .map(|canvas| {
                        let nodes = canvas.get("imageNodes").and_then(Value::as_array).cloned().unwrap_or_default();
                        let node_ids = nodes.iter().filter_map(|node| node.get("id").and_then(Value::as_str)).collect::<Vec<_>>();
                        let image_ids = nodes.iter().filter_map(|node| node.get("imageId").and_then(Value::as_str)).collect::<Vec<_>>();
                        json!({
                            "id": canvas.get("id"),
                            "projectId": canvas.get("projectId"),
                            "name": canvas.get("name"),
                            "order": canvas.get("order"),
                            "imageNodeCount": node_ids.len(),
                            "imageNodeIds": node_ids,
                            "imageIds": image_ids,
                        })
                    })
                    .collect::<Vec<_>>();
                text_result(Value::Array(canvases))
            }
            "task.list" => {
                let offset = args.get("offset").and_then(Value::as_u64).unwrap_or(0) as usize;
                let limit = args.get("limit").and_then(Value::as_u64).unwrap_or(20).clamp(1, 200) as usize;
                let project = args.get("projectId").and_then(Value::as_str);
                let canvas = args.get("canvasId").and_then(Value::as_str);
                let filtered = self.tasks().into_iter().filter(|task| {
                    project.is_none_or(|project| task.get("projectId").and_then(Value::as_str) == Some(project))
                        && canvas.is_none_or(|canvas| task.get("canvasId").and_then(Value::as_str) == Some(canvas))
                }).collect::<Vec<_>>();
                let total = filtered.len();
                let items = filtered.into_iter().skip(offset).take(limit).collect::<Vec<_>>();
                text_result(json!({"total": total, "offset": offset, "limit": limit, "items": items}))
            }
            "task.get" => {
                let Some(id) = args.get("id").and_then(Value::as_str) else {
                    return Ok(error_result("缺少 id"));
                };
                self.tasks().into_iter()
                    .find(|task| task.get("id").and_then(Value::as_str) == Some(id))
                    .map(text_result)
                    .unwrap_or_else(|| error_result("任务不存在"))
            }
            "image.get" => {
                let Some(id) = args.get("id").and_then(Value::as_str) else {
                    return Ok(error_result("缺少 id"));
                };
                match self.storage.get_file(crate::storage::Kind::Image, id) {
                    Ok(Some((meta, bytes))) => {
                        let FileMeta { mime, width, height, .. } = meta;
                        CallToolResult::success(vec![
                            ContentBlock::image(BASE64.encode(bytes), mime.clone()),
                            ContentBlock::json(json!({"id": id, "mime": mime, "width": width, "height": height})).unwrap(),
                        ]).into()
                    }
                    _ => error_result("图片不存在"),
                }
            }
            "settings.get" => {
                let Some(settings) = self.settings_value() else {
                    return Ok(error_result("没有设置数据"));
                };
                let profiles = settings.get("profiles").and_then(Value::as_array).cloned().unwrap_or_default();
                let safe_profiles = profiles.into_iter().map(|profile| {
                    json!({
                        "id": profile.get("id"),
                        "name": profile.get("name"),
                        "provider": profile.get("provider"),
                        "model": profile.get("model"),
                        "baseUrlHost": host_only(profile.get("baseUrl").and_then(Value::as_str).unwrap_or("")),
                        "apiMode": profile.get("apiMode"),
                    })
                }).collect::<Vec<_>>();
                text_result(json!({
                    "activeProfileId": settings.get("activeProfileId"),
                    "profiles": safe_profiles,
                    "enterSubmit": settings.get("enterSubmit"),
                    "batchPromptEnabled": settings.get("batchPromptEnabled"),
                }))
            }
            "task.create" => match self.write_request("task.create", &args).await {
                Ok(value) => text_result(value),
                Err(err) => error_result(&err),
            },
            "image.attach" => match self.write_request("image.attach", &args).await {
                Ok(value) => text_result(value),
                Err(err) => error_result(&err),
            },
            _ => return Ok(error_result("未知工具")),
        };
        let ok = match &result {
            CallToolResponse::Complete(result) => result.is_error != Some(true),
            _ => false,
        };
        self.shared.push_audit(&name, at, started, ok, if ok { "ok" } else { "error" });
        Ok(result)
    }
}

fn token_matches(expected: &str, provided: &str) -> bool {
    let a = expected.as_bytes();
    let b = provided.as_bytes();
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

fn local_host(value: &str) -> bool {
    let host = value.rsplit_once(':').map(|(host, _)| host).unwrap_or(value);
    host == "127.0.0.1" || host == "localhost" || host == "[::1]"
}

async fn guard(State(shared): State<Arc<Shared>>, request: Request, next: Next) -> Response {
    {
        let mut rate = shared.rate.lock().unwrap();
        let now = Instant::now();
        while rate.front().is_some_and(|entry| now.duration_since(*entry) > Duration::from_secs(60)) {
            rate.pop_front();
        }
        if rate.len() >= MAX_REQUESTS_PER_MINUTE {
            return (StatusCode::TOO_MANY_REQUESTS, "rate limit").into_response();
        }
        rate.push_back(now);
    }
    let headers: &HeaderMap = request.headers();
    if !headers.get("host").and_then(|value| value.to_str().ok()).is_some_and(local_host) {
        return (StatusCode::FORBIDDEN, "host").into_response();
    }
    if let Some(origin) = headers.get("origin").and_then(|value| value.to_str().ok()) {
        let origin_host = origin.split_once("://").map(|(_, rest)| rest).unwrap_or(origin);
        if !local_host(origin_host) {
            return (StatusCode::FORBIDDEN, "origin").into_response();
        }
    }
    let provided = headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "));
    let token = shared.token.lock().unwrap().clone();
    if !provided.is_some_and(|provided| token_matches(&token, provided)) {
        return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }
    next.run(request).await
}

fn new_token() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|err| format!("生成 token 失败：{err}"))?;
    Ok(BASE64.encode(bytes))
}

fn read_config(storage: &Storage) -> McpConfig {
    storage.meta_get(CONFIG_KEY).ok().flatten()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

fn read_token(storage: &Storage) -> Result<String, String> {
    let Some(encrypted) = storage.meta_get(TOKEN_KEY).map_err(|err| err.to_string())? else {
        return Ok(String::new());
    };
    crate::secret::secret_decrypt(encrypted)
}

fn save_token(storage: &Storage, token: &str) -> Result<(), String> {
    let encrypted = crate::secret::secret_encrypt(token.to_string())?;
    storage.meta_set(TOKEN_KEY, &encrypted).map_err(|err| err.to_string())
}

fn save_config(storage: &Storage, config: &McpConfig) -> Result<(), String> {
    let raw = serde_json::to_string(config).map_err(|err| err.to_string())?;
    storage.meta_set(CONFIG_KEY, &raw).map_err(|err| err.to_string())
}

fn ensure_token(storage: &Storage) -> Result<String, String> {
    let existing = read_token(storage)?;
    if !existing.is_empty() {
        return Ok(existing);
    }
    let token = new_token()?;
    save_token(storage, &token)?;
    Ok(token)
}

pub fn init(app: AppHandle, storage: Option<Arc<Storage>>) -> McpRuntimeState {
    let (config, token) = match storage.as_ref() {
        Some(storage) => (read_config(storage), read_token(storage).unwrap_or_default()),
        None => (McpConfig::default(), String::new()),
    };
    let shared = Arc::new(Shared {
        token: Mutex::new(token),
        write_enabled: AtomicBool::new(config.write_enabled),
        audit: Mutex::new(VecDeque::new()),
        pending: Mutex::new(HashMap::new()),
        rate: Mutex::new(VecDeque::new()),
        app: Some(app),
    });
    McpRuntimeState {
        shared,
        running: AsyncMutex::new(RunningServer { shutdown: None, task: None, port: None, error: None }),
        config: Mutex::new(config),
        storage,
    }
}

fn build_router(storage: Arc<Storage>, shared: Arc<Shared>) -> Router {
    let factory = {
        let storage = storage.clone();
        let shared = shared.clone();
        move || Ok(McpServer { storage: storage.clone(), shared: shared.clone() })
    };
    let service = StreamableHttpService::new(
        factory,
        Arc::new(LocalSessionManager::default()),
        StreamableHttpServerConfig::default(),
    );
    Router::new()
        .route_service("/mcp", service)
        .route("/", any(|| async { (StatusCode::NOT_FOUND, "not found") }))
        .layer(middleware::from_fn_with_state(shared, guard))
}

async fn stop_running(running: &mut RunningServer) {
    if let Some(shutdown) = running.shutdown.take() {
        let _ = shutdown.send(());
    }
    if let Some(mut task) = running.task.take() {
        if tokio::time::timeout(Duration::from_secs(5), &mut task).await.is_err() {
            task.abort();
            let _ = task.await;
        }
    }
    // task 结束后 listener 已释放，此时才报告停止
    running.port = None;
}

async fn stop(state: &McpRuntimeState) {
    let mut running = state.running.lock().await;
    stop_running(&mut running).await;
}

async fn start(state: &McpRuntimeState, config: &McpConfig) -> Result<u16, String> {
    let Some(storage) = state.storage.clone() else {
        return Err("存储未就绪".to_string());
    };
    let token = state.shared.token.lock().unwrap().clone();
    if token.is_empty() {
        return Err("MCP token 未生成".to_string());
    }
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", config.port))
        .await
        .map_err(|err| format!("端口 {} 不可用：{err}", config.port))?;
    let shared = state.shared.clone();
    let router = build_router(storage, shared);
    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    let task = tauri::async_runtime::spawn(async move {
        let server = axum::serve(listener, router).with_graceful_shutdown(async {
            let _ = shutdown_rx.await;
        });
        if let Err(err) = server.await {
            log::error!("MCP HTTP 服务退出：{err}");
        }
    });
    let mut running = state.running.lock().await;
    running.shutdown = Some(shutdown_tx);
    running.task = Some(task);
    running.port = Some(config.port);
    running.error = None;
    Ok(config.port)
}

pub async fn apply_config(
    app: &AppHandle,
    state: &McpRuntimeState,
    config: McpConfig,
) -> Result<McpStatus, String> {
    {
        let mut current = state.config.lock().unwrap();
        *current = config.clone();
    }
    state.shared.write_enabled.store(config.write_enabled, Ordering::Relaxed);
    let Some(storage) = state.storage.clone() else {
        return Err("存储未就绪".to_string());
    };
    save_config(&storage, &config)?;
    let had_token = !state.shared.token.lock().unwrap().is_empty();
    stop(state).await;
    if !config.enabled && had_token {
        // 停用后旧 token 立即失效；重新启用时使用新 token
        let token = new_token()?;
        save_token(&storage, &token)?;
        *state.shared.token.lock().unwrap() = token;
    }
    let mut error = None;
    if config.enabled {
        let token = state.shared.token.lock().unwrap().clone();
        if token.is_empty() {
            let token = ensure_token(&storage)?;
            *state.shared.token.lock().unwrap() = token;
        }
        if let Err(err) = start(state, &config).await {
            error = Some(err);
        }
    }
    let running = state.running.lock().await.port.is_some();
    if let Some(err) = &error {
        state.running.lock().await.error = Some(err.clone());
        let _ = app.emit("mcp-status-changed", ());
    }
    Ok(McpStatus {
        enabled: config.enabled,
        running,
        port: config.port,
        write_enabled: config.write_enabled,
        token: state.shared.token.lock().unwrap().clone(),
        error,
    })
}

fn status_of(state: &McpRuntimeState) -> McpStatus {
    let config = state.config.lock().unwrap().clone();
    let port = state.running.try_lock().ok().and_then(|running| running.port);
    McpStatus {
        enabled: config.enabled,
        running: port.is_some(),
        port: config.port,
        write_enabled: config.write_enabled,
        token: state.shared.token.lock().unwrap().clone(),
        error: state.running.try_lock().ok().and_then(|running| running.error.clone()),
    }
}

#[tauri::command]
pub async fn mcp_status(state: tauri::State<'_, McpRuntimeState>) -> Result<McpStatus, String> {
    Ok(status_of(&state))
}

#[tauri::command]
pub async fn mcp_configure(
    app: AppHandle,
    state: tauri::State<'_, McpRuntimeState>,
    enabled: bool,
    port: u16,
    write_enabled: bool,
) -> Result<McpStatus, String> {
    apply_config(&app, &state, McpConfig { enabled, port, write_enabled }).await
}

#[tauri::command]
pub async fn mcp_rotate_token(
    app: AppHandle,
    state: tauri::State<'_, McpRuntimeState>,
) -> Result<McpStatus, String> {
    let Some(storage) = state.storage.clone() else {
        return Err("存储未就绪".to_string());
    };
    let token = new_token()?;
    save_token(&storage, &token)?;
    *state.shared.token.lock().unwrap() = token;
    let config = state.config.lock().unwrap().clone();
    apply_config(&app, &state, config).await
}

#[tauri::command]
pub async fn mcp_recent_calls(
    state: tauri::State<'_, McpRuntimeState>,
) -> Result<Vec<McpAuditEntry>, String> {
    Ok(state.shared.audit.lock().unwrap().iter().cloned().collect())
}

#[tauri::command]
pub async fn mcp_write_response(
    state: tauri::State<'_, McpRuntimeState>,
    id: String,
    approved: bool,
    result: Option<Value>,
    error: Option<String>,
) -> Result<(), String> {
    let Some(pending) = state.shared.pending.lock().unwrap().remove(&id) else {
        return Err("写入请求已失效".to_string());
    };
    let _ = pending.sender.send(WriteDecision { approved, result, error });
    Ok(())
}

/// 启动并应用保存的配置；未开启时不监听端口
pub fn start_saved(app: AppHandle, state: &McpRuntimeState) {
    let config = state.config.lock().unwrap().clone();
    if !config.enabled {
        return;
    }
    if let Err(err) = tauri::async_runtime::block_on(apply_config(&app, state, config)) {
        log::error!("启动 MCP 失败：{err}");
    }
}

/// --mcp-stdio 入口：不开 GUI，只提供只读 MCP stdio，不迁移、不写 meta/tmp
pub fn run_stdio() -> std::process::ExitCode {
    let root = match crate::data_dir::current_for_read() {
        Ok(root) => root,
        Err(err) => {
            eprintln!("无法定位数据目录：{err}");
            return std::process::ExitCode::FAILURE;
        }
    };
    let storage = match crate::storage::Storage::open_read_only(&root) {
        Ok(storage) => Arc::new(storage),
        Err(err) => {
            eprintln!("无法以只读方式打开数据库：{err}");
            return std::process::ExitCode::FAILURE;
        }
    };
    tauri::async_runtime::block_on(async move {
        let shared = Arc::new(Shared {
            token: Mutex::new(String::new()),
            write_enabled: AtomicBool::new(false),
            audit: Mutex::new(VecDeque::new()),
            pending: Mutex::new(HashMap::new()),
            rate: Mutex::new(VecDeque::new()),
            app: None,
        });
        let server = McpServer { storage, shared };
        match server.serve(stdio()).await {
            Ok(service) => {
                let _ = service.waiting().await;
                std::process::ExitCode::SUCCESS
            }
            Err(err) => {
                eprintln!("MCP stdio 启动失败：{err}");
                std::process::ExitCode::FAILURE
            }
        }
    })
}

pub fn storage_state_storage(state: &StorageState) -> Option<Arc<Storage>> {
    state.0.as_ref().ok().cloned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_comparison_rejects_wrong_and_length_mismatch() {
        let token = new_token().unwrap();
        assert!(token_matches(&token, &token));
        assert!(!token_matches(&token, "wrong"));
        assert!(!token_matches(&token, &format!("{token}x")));
    }

    #[test]
    fn host_check_only_accepts_loopback() {
        assert!(local_host("127.0.0.1:7331"));
        assert!(local_host("localhost:7331"));
        assert!(!local_host("192.168.1.2:7331"));
        assert!(!local_host("evil.example.com:7331"));
    }

    #[test]
    fn sanitized_task_has_no_error_detail_or_paths() {
        let task = json!({
            "id": "t1",
            "prompt": "hi",
            "status": "error",
            "error": r"C:\Users\secret\data.db failed",
            "apiKey": "sk-secret",
            "canvas": { "x": 1 },
        });
        let value = sanitize_task(task).to_string();
        assert!(!value.contains("sk-secret"));
        assert!(!value.contains("data.db"));
        assert!(value.contains("生成失败"));
    }

    #[test]
    fn settings_host_only_strips_path_and_key() {
        assert_eq!(host_only("https://api.example.com/v1?key=sk-x"), "api.example.com");
        assert_eq!(host_only("http://127.0.0.1:8080/v1"), "127.0.0.1");
        assert_eq!(host_only(""), "");
    }

    #[test]
    fn read_only_tools_are_exposed() {
        let names = tools().into_iter().map(|tool| tool.name.to_string()).collect::<Vec<_>>();
        for required in ["project.list", "canvas.list", "task.list", "task.get", "image.get", "settings.get"] {
            assert!(names.iter().any(|name| name == required));
        }
        assert!(names.iter().any(|name| name == "task.create"));
        assert!(names.iter().any(|name| name == "image.attach"));
    }

    #[test]
    fn write_payload_uses_only_explicit_image_ids() {
        let empty = JsonObject::new();
        let payload = write_request_payload("id", "task.create", &empty);
        assert_eq!(payload["imageIds"], json!([]));
        let mut with_images = JsonObject::new();
        with_images.insert("imageIds".into(), json!(["a", "b"]));
        let payload = write_request_payload("id", "task.create", &with_images);
        assert_eq!(payload["imageIds"], json!(["a", "b"]));
    }

    #[tokio::test]
    async fn stop_releases_port_and_allows_restart() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let router = Router::new().route("/", any(|| async { "ok" }));
        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        let task = tauri::async_runtime::spawn(async move {
            let server = axum::serve(listener, router).with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
            });
            let _ = server.await;
        });
        let mut running = RunningServer {
            shutdown: Some(shutdown_tx),
            task: Some(task),
            port: Some(addr.port()),
            error: None,
        };
        stop_running(&mut running).await;
        assert!(running.port.is_none());
        assert!(tokio::net::TcpListener::bind(addr).await.is_ok());
    }

    #[tokio::test]
    async fn http_rejects_missing_token_wrong_token_and_external_origin() {
        let _ = rustls::crypto::ring::default_provider().install_default();
        let dir = tempfile::tempdir().unwrap();
        let storage = Arc::new(Storage::open(dir.path()).unwrap());
        let shared = Arc::new(Shared {
            token: Mutex::new("test-token".to_string()),
            write_enabled: AtomicBool::new(false),
            audit: Mutex::new(VecDeque::new()),
            pending: Mutex::new(HashMap::new()),
            rate: Mutex::new(VecDeque::new()),
            app: None,
        });
        let router = build_router(storage, shared);
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, router).await.unwrap();
        });
        let client = reqwest::Client::new();
        let url = format!("http://{addr}/mcp");
        let body = json!({"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}});

        let missing = client.post(&url).json(&body).send().await.unwrap();
        assert_eq!(missing.status(), StatusCode::UNAUTHORIZED);
        let wrong = client.post(&url).bearer_auth("wrong").json(&body).send().await.unwrap();
        assert_eq!(wrong.status(), StatusCode::UNAUTHORIZED);
        let origin = client
            .post(&url)
            .bearer_auth("test-token")
            .header("origin", "http://evil.example.com")
            .json(&body)
            .send()
            .await
            .unwrap();
        assert_eq!(origin.status(), StatusCode::FORBIDDEN);
        let allowed = client.post(&url).bearer_auth("test-token").json(&body).send().await.unwrap();
        assert_ne!(allowed.status(), StatusCode::UNAUTHORIZED);
        assert_ne!(allowed.status(), StatusCode::FORBIDDEN);

        // 真实 HTTP initialize + tools/list
        let init_body = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": { "name": "test", "version": "1.0.0" },
            },
        });
        let init = client
            .post(&url)
            .bearer_auth("test-token")
            .header("accept", "application/json, text/event-stream")
            .json(&init_body)
            .send()
            .await
            .unwrap();
        assert!(init.status().is_success());
        let session = init.headers().get("mcp-session-id").and_then(|value| value.to_str().ok()).unwrap_or("").to_string();
        let init_text = init.text().await.unwrap();
        assert!(init_text.contains("serverInfo"));
        let list_body = json!({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}});
        let list = client
            .post(&url)
            .bearer_auth("test-token")
            .header("accept", "application/json, text/event-stream")
            .header("mcp-session-id", session)
            .json(&list_body)
            .send()
            .await
            .unwrap();
        assert!(list.status().is_success());
        let list_text = list.text().await.unwrap();
        assert!(list_text.contains("task.list"));
        assert!(!list_text.contains("sk-"));
    }
}
