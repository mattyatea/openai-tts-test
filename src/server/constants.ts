import type { ProviderPreset } from '../contract'

export const APP_NAME = 'TTS Lab'
export const APP_VERSION = '0.1.0'

/** OpenAI TTS で選べるボイス（公式ドキュメント準拠）。 */
export const OPENAI_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'cedar',
  'coral',
  'echo',
  'fable',
  'marin',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
] as const

/** 公式に案内されている TTS モデル。 */
export const OPENAI_MODELS = [
  'gpt-4o-mini-tts',
  'gpt-4o-mini-tts-2025-12-15',
  'tts-1',
  'tts-1-hd',
] as const

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    hint: 'API キーが必要。gpt-4o-mini-tts / tts-1 / tts-1-hd。',
  },
  {
    id: 'irodori-local',
    label: 'Irodori-TTS（ローカル 8088）',
    kind: 'irodori',
    baseUrl: 'http://127.0.0.1:8088/v1',
    hint: 'Aratako/Irodori-TTS-Server の既定ポート。API キー不要。',
  },
  {
    id: 'irodori-remote',
    label: 'Irodori-TTS（リモート）',
    kind: 'irodori',
    baseUrl: '',
    hint: 'リモートの Irodori-TTS-Server。CORS 許可が必要。',
  },
  {
    id: 'custom',
    label: 'その他の OpenAI 互換サーバー',
    kind: 'custom',
    baseUrl: '',
    hint: 'OpenAI 互換の /audio/speech を持つ任意のサーバー。',
  },
]

/**
 * Irodori-TTS 公式 Gradio UI の絵文字パレット。
 * テキスト中に置くと話し方や非言語音に効く（対応チェックポイントのみ）。
 */
export const IRODORI_EMOJI = [
  { emoji: '👂', label: '囁き', description: '耳元の音' },
  { emoji: '😮‍💨', label: '吐息', description: '溜息、寝息' },
  { emoji: '⏸️', label: '間', description: '沈黙' },
  { emoji: '🤭', label: '笑い', description: 'くすくす、含み笑い' },
  { emoji: '🥵', label: '喘ぎ', description: 'うめき声、唸り声' },
  { emoji: '📢', label: 'エコー', description: 'リバーブ' },
  { emoji: '😏', label: 'からかう', description: '甘えるように' },
  { emoji: '🥺', label: '震え声', description: '自信なさげに' },
  { emoji: '🌬️', label: '息切れ', description: '荒い息遣い、呼吸音' },
  { emoji: '😮', label: '息をのむ', description: 'Gasp' },
  { emoji: '👅', label: '舐める音', description: '咀嚼音、水音' },
  { emoji: '💋', label: 'リップノイズ', description: 'Lip smack' },
  { emoji: '🫶', label: '優しく', description: 'Tenderly' },
  { emoji: '😭', label: '泣き声', description: '嗚咽、悲しみ' },
  { emoji: '😱', label: '悲鳴', description: '叫び、絶叫' },
  { emoji: '😪', label: '眠そう', description: '気だるげに' },
  { emoji: '😴', label: '寝言', description: 'いびき' },
  { emoji: '⏩', label: '早口', description: '一気に、急いで' },
  { emoji: '📞', label: '電話越し', description: 'スピーカー越し' },
  { emoji: '🐢', label: 'ゆっくり', description: 'Slowly' },
  { emoji: '🥤', label: '飲み込む', description: '唾を飲む音' },
  { emoji: '🤧', label: '咳・鼻', description: '咳き込み、鼻すすり' },
  { emoji: '😒', label: '舌打ち', description: 'Tutting' },
  { emoji: '😰', label: '慌てる', description: '動揺、緊張、どもり' },
  { emoji: '😆', label: '喜び', description: '嬉しそうに' },
  { emoji: '💥', label: '勢いよく', description: '力強い勢い' },
  { emoji: '😠', label: '怒り', description: '不満げ、拗ねる' },
  { emoji: '😲', label: '驚き', description: '感嘆' },
  { emoji: '🥱', label: 'あくび', description: 'Yawn' },
  { emoji: '😖', label: '苦しげ', description: 'Agonizingly' },
  { emoji: '😟', label: '心配', description: '不安そうに' },
  { emoji: '🫣', label: '照れ', description: '恥ずかしそうに' },
  { emoji: '🙄', label: '呆れ', description: 'Exasperatedly' },
  { emoji: '😊', label: '楽しげ', description: '嬉しそうに' },
  { emoji: '😎', label: '得意げ', description: '自信ありげに' },
  { emoji: '👌', label: '相槌', description: '頷く音' },
  { emoji: '🙏', label: '懇願', description: 'お願いするように' },
  { emoji: '🥴', label: '酔う', description: 'Drunkenly' },
  { emoji: '🎵', label: '鼻歌', description: 'Humming' },
  { emoji: '🤐', label: '口を塞ぐ', description: 'Muffled' },
  { emoji: '😌', label: '安堵', description: '満足げに' },
  { emoji: '🤔', label: '疑問', description: 'Questioning' },
  { emoji: '💪', label: '力強く', description: '力を込めて' },
  { emoji: '👃', label: '嗅ぐ音', description: '匂いを嗅ぐ音' },
  { emoji: '📖', label: '朗読', description: 'ナレーション' },
] as const

export const MEDIA_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  opus: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  pcm: 'audio/L16',
}
