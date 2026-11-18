import { SkillItem } from '../types';

export const MOCK_SKILLS: SkillItem[] = [
  {
    id: 'skill-space-kiosk',
    title: '未来无人机中转商业站',
    category: 'commercial',
    categoryLabel: '商业空间',
    description: '科技感现代化无人机中转商业配套，包含自助啤酒区、烧烤餐饮区及大型LED屏幕，专业商用空间渲染。',
    previewUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=900&auto=format&fit=crop&q=80',
    recommendedModel: 'GPT-Image-2.5 / FLUX.1-Dev',
    promptTemplate:
      '现代商业综合体中的{主体}，包含中央户外就餐区、自动精酿啤酒取酒机与餐饮烤区。顶部带有{顶部设施}，四周围绕无人机升降机坪与数字化跑马灯屏幕。采用{主色调}烤漆金属与暖光洗墙灯，真实写实商业空间摄影，清晰光泽质感，8k高分辨率建筑渲染。',
    negativePrompt:
      '模糊, 杂乱变形, 违背透视, 低分辨率, 灰暗色调, 粗糙接缝, 塑料假材质, 过曝, 水印, 文字乱码',
    tags: ['商业建筑', '快闪外摆', '科技现代', '无人机升降台', '夜晚光影'],
    author: '盼盼空间实验室',
    isFavorite: true,
    suggestedParams: {
      dimension: '2560×1440',
      quality: 'high',
      format: 'PNG',
      filter: 'standard',
    },
    variables: [
      {
        key: '主体',
        label: '商业主体设施',
        defaultValue: '无人机商业快闪综合站',
        options: ['无人机商业快闪综合站', '精品咖啡集装箱', '未来感露天生啤吧', '智慧便利零售舱'],
      },
      {
        key: '顶部设施',
        label: '顶部结构与屏幕',
        defaultValue: '大型户外超清LED环形显示屏与无人机停机坪',
        options: ['大型户外超清LED环形显示屏与无人机停机坪', '双层折叠遮阳飞翼翼板', '光伏发电曲面天幕'],
      },
      {
        key: '主色调',
        label: '品牌视觉主色调',
        defaultValue: '珠江啤酒中国红与哑光深灰金属',
        options: ['珠江啤酒中国红与哑光深灰金属', '赛博科技纯白与钛金色', '工业黑金属与原木色暖调'],
      },
    ],
  },
  {
    id: 'skill-cinematic-night',
    title: '电影级商业夜景打光',
    category: 'lighting',
    categoryLabel: '光影镜头',
    description: '采用蓝调时刻与高对比暖色洗墙灯的冷暖交织布光，提升商业建筑在夜幕中的立体感与通透度。',
    previewUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&auto=format&fit=crop&q=80',
    recommendedModel: 'FLUX.1-Dev / SDXL',
    promptTemplate:
      '暮色降临时的{场景空间}，蓝调时刻（Blue Hour）深邃天空。建筑轮廓镶嵌{灯带色温}连续LED泛光，地面光滑如镜映照出暖金色的柔和倒影。哈苏中画幅相机拍摄，f/4.0光圈，长曝光细腻光轨，通透高动态范围HDR。',
    negativePrompt:
      '全黑暗部死黑, 高光过曝死白, 噪点粗糙, 镜头脏污, 涂抹感, 虚焦',
    tags: ['夜景光效', '冷暖对比', '蓝调时刻', '倒影漫反射', '电影质感'],
    author: 'Cinematic Studio',
    isFavorite: true,
    suggestedParams: {
      dimension: '2560×1440',
      quality: 'high',
      filter: 'standard',
    },
    variables: [
      {
        key: '场景空间',
        label: '拍摄场景',
        defaultValue: '户外商业啤酒广场与无人零售站',
        options: ['户外商业啤酒广场与无人零售站', '高端精品店街区转角', '半开放式屋顶露天吧台'],
      },
      {
        key: '灯带色温',
        label: '灯光色温',
        defaultValue: '3000K金暖光与霓虹荧光色',
        options: ['3000K金暖光与霓虹荧光色', '4500K中性科技纯白光', '赛博品红与冰蓝对比光'],
      },
    ],
  },
  {
    id: 'skill-architectural-materials',
    title: '写实建筑金属与微水泥材质',
    category: 'materials',
    categoryLabel: '材质质感',
    description: '细致刻画氟碳喷涂铝板、阳极氧化金属拉丝、超白钢化玻璃与微水泥地面的微观纹理与高光漫反射。',
    previewUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=900&auto=format&fit=crop&q=80',
    recommendedModel: 'FLUX.1-Dev',
    promptTemplate:
      '特写近景渲染{构件部分}，表面采用{核心材质}，带有微妙的拉丝纹理与微距各向异性高光反射。接缝处具备0.5mm精密公差金属嵌条，超白低铁玻璃清晰透亮无绿边，呈现真实世界物理渲染PBR材质细节。',
    negativePrompt:
      '塑料感, 平整无细节贴图, 污渍脏斑, 材质模糊, 粗制滥造, 重影',
    tags: ['PBR材质', '金属拉丝', '超白玻璃', '微水泥', '工业级工艺'],
    author: 'PBR Material Lab',
    isFavorite: false,
    variables: [
      {
        key: '构件部分',
        label: '展示构件',
        defaultValue: '吧台立面与取酒龙头面板',
        options: ['吧台立面与取酒龙头面板', '屋顶悬挑飞翼檐口', '互动触控立柱外壳'],
      },
      {
        key: '核心材质',
        label: '主体材质',
        defaultValue: '深红氟碳烤漆哑光铝单板与黄铜拉丝件',
        options: ['深红氟碳烤漆哑光铝单板与黄铜拉丝件', '暗黑阳极氧化钛合金', '浅灰清水混凝土微水泥'],
      },
    ],
  },
  {
    id: 'skill-wide-angle-arch',
    title: '建筑大师大广角视平线构图',
    category: 'lighting',
    categoryLabel: '光影镜头',
    description: '严格遵循两点透视，平视人眼视角（1.6m视高），16:9黄金宽幅比例，突出商业实体的气势与空间纵深。',
    previewUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&auto=format&fit=crop&q=80',
    recommendedModel: 'GPT-Image-2.5',
    promptTemplate:
      '两点透视人眼视平线角度（视高1.6米），{焦段设置}超广角无畸变镜头，正面横向平视捕捉{构图主体}。左右比例严格平衡，近景广场地面石材微反光，中景主体结构分明，背景融入现代化城市天际线，大景深锐利清晰。',
    negativePrompt:
      '鱼眼弯曲变形, 倾斜俯仰角畸变, 比例失真, 局部遮挡, 模糊虚化',
    tags: ['两点透视', '人眼平视', '16:9宽画幅', '大景深', '建筑大师摄影'],
    author: 'ArchViz Master',
    isFavorite: true,
    suggestedParams: {
      dimension: '2560×1440',
      format: 'PNG',
    },
    variables: [
      {
        key: '焦段设置',
        label: '镜头焦段',
        defaultValue: '24mm移轴镜头',
        options: ['24mm移轴镜头', '35mm人文大师定焦', '18mm超广角透视矫正'],
      },
      {
        key: '构图主体',
        label: '主体构图',
        defaultValue: '双拼模块化商业餐饮亭与无人机起降区',
        options: ['双拼模块化商业餐饮亭与无人机起降区', '长条形开放式生啤自助吧台', '高科技未来概念驿站全景'],
      },
    ],
  },
  {
    id: 'skill-master-negative',
    title: '商业空间大师级通用负向增强',
    category: 'negative',
    categoryLabel: '负向增强',
    description: '过滤常见建筑与商业空间生图瑕疵：包含乱码招牌、畸变人体、错误透视、塑料反光与低画质压缩痕迹。',
    previewUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?w=900&auto=format&fit=crop&q=80',
    recommendedModel: '通用所有模型 (Universal)',
    promptTemplate:
      '--neg (worst quality, low quality, normal quality:1.4), (blurry, out of focus), bad architecture, tilted vertical lines, incorrect perspective, warped walls, lowres, text distortion, gibberish letters, watermark, signature, oversaturated plastic gloss, fake render, bad proportions, cloned people, extra limbs',
    negativePrompt:
      '(worst quality, low quality:1.4), blurry, deformed, bad architecture perspective, converging verticals, cartoonish, lowres, text error, watermark, noisy, blown out highlights',
    tags: ['终极负向', '去瑕疵', '矫正透视', '去塑料感', '通用必备'],
    author: '盼盼技术组',
    isFavorite: true,
  },
  {
    id: 'skill-cyber-pop',
    title: '赛博潮酷未来主义快闪店',
    category: 'styles',
    categoryLabel: '艺术风格',
    description: '结合半透明炫彩亚克力、流光发光管与模块化装配工业风，年轻化潮流打卡商业场景。',
    previewUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=900&auto=format&fit=crop&q=80',
    recommendedModel: 'FLUX.1-Dev',
    promptTemplate:
      '未来潮酷概念{店铺类型}，采用渐变炫彩镭射半透明亚克力板材，搭配暗黑阳极氧化工业铝型材。中央设置{核心互动区}，环绕动态流光跑马灯带。地面采用防滑金属钢网格与暗色环氧树脂，极具视觉冲击力的年轻化商业潮流空间。',
    negativePrompt:
      '俗气高饱和色块, 杂乱无章, 灰蒙蒙, 劣质网吧风, 贴图穿模',
    tags: ['潮流快闪', '赛博霓虹', '炫彩亚克力', '模块化设计', '潮人聚集地'],
    author: 'CyberPop Studio',
    isFavorite: false,
    variables: [
      {
        key: '店铺类型',
        label: '空间业态',
        defaultValue: '精酿啤酒与潮流联名快闪舱',
        options: ['精酿啤酒与潮流联名快闪舱', '街头潮牌无人概念店', '数字艺术黑胶声学空间'],
      },
      {
        key: '核心互动区',
        label: '核心亮点',
        defaultValue: '全息透明酒单触控屏与自动打酒管路展示橱窗',
        options: ['全息透明酒单触控屏与自动打酒管路展示橱窗', '机械臂倒酒表演站', '沉浸式互动地面感应装置'],
      },
    ],
  },
  {
    id: 'skill-industrial-hardware',
    title: '精密机械与智能设备特写',
    category: 'product',
    categoryLabel: '工业硬件',
    description: '工业级智能硬件与结构件特写，如无人机升降导轨、伺服电机传动结构、自助取酒阀组细节。',
    previewUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=900&auto=format&fit=crop&q=80',
    recommendedModel: 'FLUX.1-Dev / SDXL',
    promptTemplate:
      '工业级机械设备特写：{硬件设备}。高强度CNC切削铝合金机身，细腻喷砂哑光质感，激光雕刻微小刻度与状态指示灯。露出精密行星齿轮与步进电机传动机构，德系精工制造，摄影棚柔光箱无影布光，8k微距极高锐利度。',
    negativePrompt:
      '粗糙毛刺, 齿轮变形咬死, 劣质塑料, 倒角错误, 模糊细节, 脏污锈蚀',
    tags: ['精密工业', 'CNC切削', '微距特写', '机械传动', '硬核科技'],
    author: 'Industrial Master',
    isFavorite: false,
    variables: [
      {
        key: '硬件设备',
        label: '设备名称',
        defaultValue: '商用多通道智能生啤分流注液阀组与机械臂爪手',
        options: ['商用多通道智能生啤分流注液阀组与机械臂爪手', '无人机升降导轨伸缩悬臂结构', '商业交互触摸机防水防爆面板'],
      },
    ],
  },
];
