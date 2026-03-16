/**
 * Cinematic Presets — Prompt Assembly Engine
 *
 * Builds a fully assembled cinematic prompt from user subject text
 * plus structured CinematicConfig preset selections. Each preset
 * category maps to a professional photography/cinematography term
 * that models understand natively.
 *
 * Also exports preset data and lookup helpers for the Studio UI components.
 */

import type { CinematicConfig, CinematicPreset, PresetCategory, SceneGenerationConfig, GenrePreset } from '@/types/creative-studio';

// ─── Preset Data ──────────────────────────────────────────────────

const SHOT_TYPE_PRESETS: CinematicPreset[] = [
  { id: 'shot-extreme-close-up', name: 'Extreme Close-Up', category: 'shotType', promptFragment: 'extreme close-up shot', tags: ['close', 'detail', 'intimate'] },
  { id: 'shot-close-up', name: 'Close-Up', category: 'shotType', promptFragment: 'close-up shot', tags: ['close', 'portrait', 'face'] },
  { id: 'shot-medium-close', name: 'Medium Close-Up', category: 'shotType', promptFragment: 'medium close-up shot', tags: ['medium', 'bust'] },
  { id: 'shot-medium', name: 'Medium Shot', category: 'shotType', promptFragment: 'medium shot', tags: ['medium', 'waist'] },
  { id: 'shot-medium-wide', name: 'Medium Wide', category: 'shotType', promptFragment: 'medium wide shot', tags: ['medium', 'knees'] },
  { id: 'shot-wide', name: 'Wide Shot', category: 'shotType', promptFragment: 'wide shot', tags: ['wide', 'full-body'] },
  { id: 'shot-extreme-wide', name: 'Extreme Wide', category: 'shotType', promptFragment: 'extreme wide establishing shot', tags: ['wide', 'landscape', 'establishing'] },
  { id: 'shot-over-shoulder', name: 'Over the Shoulder', category: 'shotType', promptFragment: 'over-the-shoulder shot', tags: ['conversation', 'perspective'] },
  { id: 'shot-dutch-angle', name: 'Dutch Angle', category: 'shotType', promptFragment: 'Dutch angle tilted shot', tags: ['dramatic', 'tilted', 'tension'] },
  { id: 'shot-birds-eye', name: "Bird's Eye View", category: 'shotType', promptFragment: "bird's eye view overhead shot", tags: ['aerial', 'overhead', 'top-down'] },
  { id: 'shot-low-angle', name: 'Low Angle', category: 'shotType', promptFragment: 'low angle upward shot', tags: ['power', 'dramatic', 'heroic'] },
  { id: 'shot-high-angle', name: 'High Angle', category: 'shotType', promptFragment: 'high angle downward shot', tags: ['vulnerable', 'overview'] },
  { id: 'shot-pov', name: 'POV Shot', category: 'shotType', promptFragment: 'first-person POV shot', tags: ['subjective', 'immersive'] },
  { id: 'shot-cutaway', name: 'Cutaway', category: 'shotType', promptFragment: 'cutaway detail insert shot', tags: ['detail', 'insert', 'b-roll'] },
  { id: 'shot-establishing', name: 'Establishing Shot', category: 'shotType', promptFragment: 'establishing shot showing full environment and context', tags: ['wide', 'context', 'scene-setter'] },
  { id: 'shot-full-body', name: 'Full Body', category: 'shotType', promptFragment: 'full body shot from head to toe', tags: ['full', 'body', 'fashion'] },
  { id: 'shot-group', name: 'Group Shot', category: 'shotType', promptFragment: 'group shot showing multiple subjects together', tags: ['group', 'ensemble', 'team'] },
  { id: 'shot-insert', name: 'Insert Shot', category: 'shotType', promptFragment: 'tight insert shot on specific object or detail', tags: ['detail', 'object', 'close'] },
  { id: 'shot-rack-focus', name: 'Rack Focus', category: 'shotType', promptFragment: 'rack focus shifting depth of field between foreground and background', tags: ['focus', 'depth', 'transition'] },
  { id: 'shot-sniper', name: 'Sniper Shot', category: 'shotType', promptFragment: 'sniper scope view, crosshair framing, extreme telephoto', tags: ['telephoto', 'surveillance', 'tension'] },
  { id: 'shot-split-screen', name: 'Split Screen', category: 'shotType', promptFragment: 'split screen composition showing two perspectives simultaneously', tags: ['split', 'dual', 'parallel'] },
  { id: 'shot-steadicam', name: 'Steadicam', category: 'shotType', promptFragment: 'smooth Steadicam following shot, fluid continuous movement', tags: ['smooth', 'tracking', 'following'] },
  { id: 'shot-three-quarter', name: 'Three Quarter Body', category: 'shotType', promptFragment: 'three-quarter body shot from knees up', tags: ['three-quarter', 'portrait'] },
  { id: 'shot-tight-headshot', name: 'Tight Headshot', category: 'shotType', promptFragment: 'tight headshot, face filling frame, intimate portrait', tags: ['headshot', 'tight', 'portrait'] },
  { id: 'shot-tracking', name: 'Tracking Shot', category: 'shotType', promptFragment: 'dynamic tracking shot following subject movement', tags: ['tracking', 'movement', 'dynamic'] },
  { id: 'shot-worms-eye', name: "Worm's Eye View", category: 'shotType', promptFragment: "worm's eye view, extreme low angle from ground level looking up", tags: ['low', 'ground', 'dramatic'] },
  { id: 'shot-overhead', name: 'Overhead', category: 'shotType', promptFragment: 'direct overhead top-down flat lay composition', tags: ['overhead', 'flat-lay', 'top-down'] },
];

const CAMERA_PRESETS: CinematicPreset[] = [
  { id: 'cam-arri-alexa', name: 'ARRI ALEXA 65', category: 'camera', promptFragment: 'shot on ARRI ALEXA 65', tags: ['cinema', 'high-end', 'film'] },
  { id: 'cam-red-v-raptor', name: 'RED V-RAPTOR', category: 'camera', promptFragment: 'shot on RED V-RAPTOR 8K', tags: ['cinema', '8k', 'digital'] },
  { id: 'cam-sony-venice', name: 'Sony VENICE 2', category: 'camera', promptFragment: 'shot on Sony VENICE 2', tags: ['cinema', 'full-frame', 'digital'] },
  { id: 'cam-canon-c500', name: 'Canon EOS C500 II', category: 'camera', promptFragment: 'shot on Canon EOS C500 Mark II', tags: ['cinema', 'canon'] },
  { id: 'cam-hasselblad', name: 'Hasselblad X2D', category: 'camera', promptFragment: 'shot on Hasselblad X2D 100C', tags: ['medium-format', 'portrait', 'fashion'] },
  { id: 'cam-leica-m11', name: 'Leica M11', category: 'camera', promptFragment: 'shot on Leica M11', tags: ['street', 'rangefinder', 'classic'] },
  { id: 'cam-nikon-z9', name: 'Nikon Z9', category: 'camera', promptFragment: 'shot on Nikon Z9', tags: ['mirrorless', 'sports', 'wildlife'] },
  { id: 'cam-iphone', name: 'iPhone 16 Pro', category: 'camera', promptFragment: 'shot on iPhone 16 Pro', tags: ['mobile', 'modern', 'casual'] },
  { id: 'cam-polaroid', name: 'Polaroid SX-70', category: 'camera', promptFragment: 'Polaroid instant photo', tags: ['vintage', 'instant', 'nostalgic'] },
  { id: 'cam-8mm-film', name: '8mm Film Camera', category: 'camera', promptFragment: 'shot on 8mm film camera, vintage film grain, narrow frame, home movie quality', tags: ['vintage', '8mm', 'home-movie'] },
  { id: 'cam-16mm-film', name: '16mm Film Camera', category: 'camera', promptFragment: 'shot on 16mm film camera, documentary grain, indie film texture', tags: ['16mm', 'indie', 'documentary'] },
  { id: 'cam-35mm-film', name: '35mm Film Camera', category: 'camera', promptFragment: 'shot on 35mm film camera, classic cinema grain and color rendition', tags: ['35mm', 'classic', 'cinema'] },
  { id: 'cam-aaton-atx', name: 'Aaton ATX', category: 'camera', promptFragment: 'shot on Aaton ATX, French documentary cinema, organic handheld feel', tags: ['documentary', 'french', 'organic'] },
  { id: 'cam-arri-c3', name: 'ARRI C3', category: 'camera', promptFragment: 'shot on vintage ARRI C3, golden age Hollywood motion picture quality', tags: ['vintage', 'hollywood', 'classic'] },
  { id: 'cam-blackmagic', name: 'Blackmagic URSA', category: 'camera', promptFragment: 'shot on Blackmagic URSA Mini Pro, wide dynamic range digital cinema', tags: ['digital', 'cinema', 'indie'] },
  { id: 'cam-canon-c300', name: 'Canon C300', category: 'camera', promptFragment: 'shot on Canon C300, broadcast quality, natural color science', tags: ['broadcast', 'documentary', 'canon'] },
  { id: 'cam-canon-5d', name: 'Canon EOS 5D', category: 'camera', promptFragment: 'shot on Canon EOS 5D Mark IV, full-frame DSLR cinematic look', tags: ['dslr', 'full-frame', 'popular'] },
  { id: 'cam-compact', name: 'Compact Camera', category: 'camera', promptFragment: 'shot on compact point-and-shoot camera, consumer quality, flash artifacts', tags: ['compact', 'consumer', 'casual'] },
  { id: 'cam-contax-t2', name: 'Contax T2', category: 'camera', promptFragment: 'shot on Contax T2, premium compact, Carl Zeiss optics, celebrity snapshot', tags: ['compact', 'premium', 'zeiss'] },
  { id: 'cam-doorbell', name: 'Doorbell Cam', category: 'camera', promptFragment: 'doorbell camera footage, fisheye distortion, surveillance quality, night vision', tags: ['surveillance', 'fisheye', 'security'] },
  { id: 'cam-drone', name: 'Drone Camera', category: 'camera', promptFragment: 'aerial drone footage, DJI quality, sweeping overhead perspective', tags: ['aerial', 'drone', 'overhead'] },
  { id: 'cam-fuji-xt4', name: 'Fujifilm X-T4', category: 'camera', promptFragment: 'shot on Fujifilm X-T4, classic chrome film simulation, APS-C', tags: ['fuji', 'film-simulation', 'retro'] },
  { id: 'cam-gopro', name: 'GoPro Hero', category: 'camera', promptFragment: 'shot on GoPro Hero, action camera wide angle, high frame rate', tags: ['action', 'wide', 'sports'] },
  { id: 'cam-hasselblad-x1d', name: 'Hasselblad X1D', category: 'camera', promptFragment: 'shot on Hasselblad X1D, medium format, extraordinary detail and color depth', tags: ['medium-format', 'fashion', 'studio'] },
  { id: 'cam-hasselblad-500c', name: 'Hasselblad 500C', category: 'camera', promptFragment: 'shot on vintage Hasselblad 500C, square format, NASA-quality medium format', tags: ['medium-format', 'vintage', 'square'] },
  { id: 'cam-kodak-brownie', name: 'Kodak Brownie', category: 'camera', promptFragment: 'shot on Kodak Brownie box camera, early 20th century snapshot quality', tags: ['antique', 'box', 'historical'] },
  { id: 'cam-kodak-tungsten', name: 'Kodak Tungsten', category: 'camera', promptFragment: 'shot on Kodak motion picture camera with tungsten-balanced film stock', tags: ['motion-picture', 'tungsten', 'cinema'] },
  { id: 'cam-leica-m3', name: 'Leica M3', category: 'camera', promptFragment: 'shot on Leica M3 rangefinder, street photography legend, precise rendering', tags: ['rangefinder', 'street', 'classic'] },
  { id: 'cam-lomo-lca', name: 'Lomo LC-A', category: 'camera', promptFragment: 'shot on Lomo LC-A, lomography vignette, saturated colors, light leaks', tags: ['lomo', 'lo-fi', 'creative'] },
  { id: 'cam-mamiya-rb67', name: 'Mamiya RB67', category: 'camera', promptFragment: 'shot on Mamiya RB67, medium format portrait, incredible resolution', tags: ['medium-format', 'portrait', 'studio'] },
  { id: 'cam-minolta-srt101', name: 'Minolta SRT-101', category: 'camera', promptFragment: 'shot on Minolta SRT-101, 1970s SLR, warm vintage Rokkor lens character', tags: ['vintage', '70s', 'warm'] },
  { id: 'cam-nikon-d850', name: 'Nikon D850', category: 'camera', promptFragment: 'shot on Nikon D850, 45MP full-frame, exceptional sharpness and dynamic range', tags: ['nikon', 'full-frame', 'sharp'] },
  { id: 'cam-nikon-f2', name: 'Nikon F2', category: 'camera', promptFragment: 'shot on Nikon F2, professional 35mm film SLR, photojournalism workhorse', tags: ['film', 'professional', 'journalism'] },
  { id: 'cam-nikon-fm2', name: 'Nikon FM2', category: 'camera', promptFragment: 'shot on Nikon FM2, manual focus film camera, student favorite', tags: ['film', 'manual', 'classic'] },
  { id: 'cam-olympus-om1', name: 'Olympus OM-1', category: 'camera', promptFragment: 'shot on Olympus OM-1, compact SLR, bright viewfinder, travel photography', tags: ['compact', 'travel', 'classic'] },
  { id: 'cam-old-android', name: 'Old Android Phone', category: 'camera', promptFragment: 'shot on old Android phone, low resolution, noisy sensor, amateur quality', tags: ['phone', 'lo-fi', 'amateur'] },
  { id: 'cam-panavision', name: 'Panavision Panaflex', category: 'camera', promptFragment: 'shot on Panavision Panaflex, Hollywood studio camera, anamorphic cinema', tags: ['hollywood', 'anamorphic', 'studio'] },
  { id: 'cam-pentax-k1000', name: 'Pentax K1000', category: 'camera', promptFragment: 'shot on Pentax K1000, fully mechanical SLR, student photography classic', tags: ['mechanical', 'student', 'classic'] },
  { id: 'cam-phase-one', name: 'Phase One XF', category: 'camera', promptFragment: 'shot on Phase One XF 100MP, ultra-high resolution medium format digital', tags: ['medium-format', 'digital', 'ultra-res'] },
  { id: 'cam-rolleiflex', name: 'Rolleiflex', category: 'camera', promptFragment: 'shot on Rolleiflex twin-lens reflex, waist-level viewfinder, square format', tags: ['tlr', 'square', 'vintage'] },
  { id: 'cam-security', name: 'Security Camera', category: 'camera', promptFragment: 'security camera CCTV footage, high angle, low resolution, timestamp overlay', tags: ['surveillance', 'cctv', 'lo-fi'] },
  { id: 'cam-sony-a7iii', name: 'Sony A7III', category: 'camera', promptFragment: 'shot on Sony A7III, full-frame mirrorless, excellent low-light performance', tags: ['mirrorless', 'full-frame', 'versatile'] },
  { id: 'cam-sony-fx6', name: 'Sony FX6', category: 'camera', promptFragment: 'shot on Sony FX6, cinema line, full-frame sensor, documentary cinema', tags: ['cinema', 'full-frame', 'documentary'] },
  { id: 'cam-super-8', name: 'Super 8', category: 'camera', promptFragment: 'shot on Super 8 film, nostalgic home movie quality, organic grain and flicker', tags: ['super-8', 'nostalgic', 'home-movie'] },
  { id: 'cam-trail', name: 'Trail Camera', category: 'camera', promptFragment: 'trail camera wildlife footage, infrared night vision, motion-triggered', tags: ['wildlife', 'infrared', 'night'] },
  { id: 'cam-vhs', name: 'VHS Camera', category: 'camera', promptFragment: 'shot on VHS camcorder, tracking artifacts, interlaced scan lines, lo-fi video', tags: ['vhs', 'retro', 'lo-fi'] },
  { id: 'cam-webcam', name: 'Webcam', category: 'camera', promptFragment: 'webcam footage, flat lighting, compressed quality, video call aesthetic', tags: ['webcam', 'lo-fi', 'digital'] },
  { id: 'cam-yashica', name: 'Yashica Mat-124G', category: 'camera', promptFragment: 'shot on Yashica Mat-124G, twin-lens reflex medium format, soft rendering', tags: ['tlr', 'medium-format', 'soft'] },
  { id: 'cam-zenit', name: 'Zenit-E', category: 'camera', promptFragment: 'shot on Zenit-E, Soviet-era SLR, Helios lens character, distinctive flare', tags: ['soviet', 'vintage', 'helios'] },
  { id: 'cam-medium-format-digital', name: 'Medium Format Digital', category: 'camera', promptFragment: 'shot on medium format digital camera, extraordinary depth and micro-contrast', tags: ['medium-format', 'digital', 'studio'] },
  { id: 'cam-large-format', name: 'Large Format 4x5', category: 'camera', promptFragment: 'shot on 4x5 large format view camera, extreme detail, tilt-shift plane of focus', tags: ['large-format', 'detail', 'architectural'] },
];

const FOCAL_LENGTH_PRESETS: CinematicPreset[] = [
  { id: 'fl-8mm', name: '8mm Fisheye', category: 'focalLength', promptFragment: '8mm fisheye lens, extreme barrel distortion, ultra-wide 180-degree field of view', tags: ['fisheye', 'distortion', 'extreme'] },
  { id: 'fl-14mm', name: '14mm Ultra Wide', category: 'focalLength', promptFragment: '14mm ultra-wide angle', tags: ['ultra-wide', 'distortion', 'dramatic'] },
  { id: 'fl-24mm', name: '24mm Wide', category: 'focalLength', promptFragment: '24mm wide angle lens', tags: ['wide', 'landscape', 'architecture'] },
  { id: 'fl-35mm', name: '35mm Standard', category: 'focalLength', promptFragment: '35mm lens', tags: ['standard', 'street', 'documentary'] },
  { id: 'fl-50mm', name: '50mm Normal', category: 'focalLength', promptFragment: '50mm lens', tags: ['normal', 'natural', 'portrait'] },
  { id: 'fl-85mm', name: '85mm Portrait', category: 'focalLength', promptFragment: '85mm portrait lens', tags: ['portrait', 'bokeh', 'flattering'] },
  { id: 'fl-135mm', name: '135mm Telephoto', category: 'focalLength', promptFragment: '135mm telephoto lens', tags: ['telephoto', 'compression', 'portrait'] },
  { id: 'fl-200mm', name: '200mm Telephoto', category: 'focalLength', promptFragment: '200mm telephoto lens', tags: ['telephoto', 'sports', 'wildlife'] },
  { id: 'fl-100mm', name: '100mm Macro', category: 'focalLength', promptFragment: '100mm macro lens, extreme close-up detail, 1:1 magnification', tags: ['macro', 'detail', 'close-up'] },
  { id: 'fl-300mm', name: '300mm Extreme Telephoto', category: 'focalLength', promptFragment: '300mm extreme telephoto, extreme background compression, distant subject isolation', tags: ['extreme-telephoto', 'compression', 'distance'] },
  { id: 'fl-400mm', name: '400mm Super Tele', category: 'focalLength', promptFragment: '400mm super telephoto lens', tags: ['super-telephoto', 'wildlife', 'sports'] },
];

const LENS_TYPE_PRESETS: CinematicPreset[] = [
  { id: 'lens-anamorphic', name: 'Anamorphic', category: 'lensType', promptFragment: 'anamorphic lens with lens flares', tags: ['cinematic', 'flare', 'widescreen'] },
  { id: 'lens-tilt-shift', name: 'Tilt-Shift', category: 'lensType', promptFragment: 'tilt-shift lens miniature effect', tags: ['miniature', 'selective-focus'] },
  { id: 'lens-macro', name: 'Macro', category: 'lensType', promptFragment: 'macro lens extreme close-up', tags: ['macro', 'detail', 'close'] },
  { id: 'lens-fisheye', name: 'Fisheye', category: 'lensType', promptFragment: 'fisheye lens barrel distortion', tags: ['distortion', 'wide', 'creative'] },
  { id: 'lens-soft-focus', name: 'Soft Focus', category: 'lensType', promptFragment: 'soft focus diffused lens', tags: ['dreamy', 'soft', 'romantic'] },
  { id: 'lens-prime', name: 'Sharp Prime', category: 'lensType', promptFragment: 'razor-sharp prime lens', tags: ['sharp', 'prime', 'quality'] },
  { id: 'lens-vintage', name: 'Vintage Lens', category: 'lensType', promptFragment: 'vintage lens with character and imperfections', tags: ['vintage', 'flawed', 'character'] },
  { id: 'lens-dioptic', name: 'Dioptic (Infrared)', category: 'lensType', promptFragment: 'dioptic infrared lens, false color rendering, thermal vision effect', tags: ['infrared', 'thermal', 'experimental'] },
  { id: 'lens-helios', name: 'Helios 44-2 Swirly Bokeh', category: 'lensType', promptFragment: 'Helios 44-2 lens, swirly bokeh, vintage Soviet lens character', tags: ['swirly', 'bokeh', 'soviet'] },
  { id: 'lens-holga', name: 'Holga Style', category: 'lensType', promptFragment: 'Holga plastic lens, heavy vignette, soft focus blur, lo-fi toy camera', tags: ['plastic', 'lo-fi', 'toy'] },
  { id: 'lens-lensbaby', name: 'Lensbaby / Selective Focus', category: 'lensType', promptFragment: 'Lensbaby selective focus, sweet spot of sharpness surrounded by blur', tags: ['selective', 'creative', 'blur'] },
  { id: 'lens-petzval', name: 'Petzval Portrait', category: 'lensType', promptFragment: 'Petzval portrait lens, swirly bokeh, sharp center with dreamy edges', tags: ['portrait', 'swirly', 'vintage'] },
  { id: 'lens-toy', name: 'Toy Plastic', category: 'lensType', promptFragment: 'toy plastic camera lens, extreme distortion, color shifts, light leaks', tags: ['toy', 'plastic', 'lo-fi'] },
  { id: 'lens-voigtlander', name: 'Voigtlander Nokton 50mm', category: 'lensType', promptFragment: 'Voigtlander Nokton 50mm f/1.1, extremely shallow depth, dreamy wide open', tags: ['fast', 'shallow', 'dreamy'] },
];

const LIGHTING_PRESETS: CinematicPreset[] = [
  { id: 'light-golden-hour', name: 'Golden Hour', category: 'lighting', promptFragment: 'warm golden hour sunlight', tags: ['warm', 'natural', 'sunset'] },
  { id: 'light-blue-hour', name: 'Blue Hour', category: 'lighting', promptFragment: 'cool blue hour twilight lighting', tags: ['cool', 'twilight', 'moody'] },
  { id: 'light-rembrandt', name: 'Rembrandt', category: 'lighting', promptFragment: 'Rembrandt lighting with dramatic shadow triangle', tags: ['dramatic', 'portrait', 'classic'] },
  { id: 'light-butterfly', name: 'Butterfly', category: 'lighting', promptFragment: 'butterfly overhead lighting', tags: ['glamour', 'beauty', 'fashion'] },
  { id: 'light-split', name: 'Split Lighting', category: 'lighting', promptFragment: 'dramatic split lighting half-face shadow', tags: ['dramatic', 'noir', 'contrast'] },
  { id: 'light-neon', name: 'Neon', category: 'lighting', promptFragment: 'vibrant neon lighting with color spill', tags: ['neon', 'urban', 'cyberpunk'] },
  { id: 'light-natural-window', name: 'Window Light', category: 'lighting', promptFragment: 'soft natural window light', tags: ['natural', 'soft', 'indoor'] },
  { id: 'light-rim', name: 'Rim Light', category: 'lighting', promptFragment: 'strong rim lighting silhouette edge', tags: ['edge', 'dramatic', 'separation'] },
  { id: 'light-hard-flash', name: 'Hard Flash', category: 'lighting', promptFragment: 'direct hard flash photography', tags: ['flash', 'harsh', 'editorial'] },
  { id: 'light-studio-three', name: 'Three-Point Studio', category: 'lighting', promptFragment: 'professional three-point studio lighting', tags: ['studio', 'professional', 'controlled'] },
  { id: 'light-volumetric', name: 'Volumetric', category: 'lighting', promptFragment: 'volumetric god rays atmospheric lighting', tags: ['atmospheric', 'rays', 'ethereal'] },
  { id: 'light-overcast', name: 'Overcast Diffused', category: 'lighting', promptFragment: 'soft diffused overcast lighting', tags: ['even', 'diffused', 'natural'] },
  { id: 'light-bounce', name: 'Bounce Lighting', category: 'lighting', promptFragment: 'bounce lighting from reflector, soft fill, reduced shadows', tags: ['fill', 'soft', 'reflector'] },
  { id: 'light-broad', name: 'Broad Lighting', category: 'lighting', promptFragment: 'broad lighting with illuminated side of face toward camera', tags: ['portrait', 'flattering', 'wide'] },
  { id: 'light-candlelight', name: 'Candlelight', category: 'lighting', promptFragment: 'warm candlelight ambiance, flickering warm orange glow, intimate', tags: ['warm', 'intimate', 'fire'] },
  { id: 'light-chiaroscuro', name: 'Chiaroscuro', category: 'lighting', promptFragment: 'chiaroscuro dramatic contrast of light and shadow, Caravaggio-style', tags: ['dramatic', 'contrast', 'renaissance'] },
  { id: 'light-color-gels', name: 'Color Gels', category: 'lighting', promptFragment: 'color gel lighting, tinted light sources, creative color wash', tags: ['creative', 'color', 'artistic'] },
  { id: 'light-cross', name: 'Cross Lighting', category: 'lighting', promptFragment: 'cross lighting from two sides, dramatic texture and dimension', tags: ['dramatic', 'texture', 'dimensional'] },
  { id: 'light-cyberpunk-neon', name: 'Cyberpunk Neon', category: 'lighting', promptFragment: 'cyberpunk neon lighting, pink and cyan color spill, wet reflections', tags: ['cyberpunk', 'neon', 'futuristic'] },
  { id: 'light-dawn', name: 'Dawn Light', category: 'lighting', promptFragment: 'early dawn light, soft pink and purple pre-sunrise, delicate', tags: ['dawn', 'soft', 'early-morning'] },
  { id: 'light-diffuse-ugc', name: 'Diffuse / UGC', category: 'lighting', promptFragment: 'diffuse UGC-style lighting, flat even light, selfie quality', tags: ['ugc', 'flat', 'casual'] },
  { id: 'light-dramatic-side', name: 'Dramatic Side Light', category: 'lighting', promptFragment: 'dramatic single-source side lighting, deep shadows, moody', tags: ['dramatic', 'side', 'moody'] },
  { id: 'light-dusk', name: 'Dusk', category: 'lighting', promptFragment: 'dusk lighting, warm amber fading to cool blue, twilight transition', tags: ['dusk', 'twilight', 'transition'] },
  { id: 'light-fluorescent', name: 'Fluorescent', category: 'lighting', promptFragment: 'harsh fluorescent overhead lighting, green-tinged, institutional', tags: ['harsh', 'institutional', 'green'] },
  { id: 'light-high-key', name: 'High Key', category: 'lighting', promptFragment: 'high-key bright even lighting, minimal shadows, clean and airy', tags: ['bright', 'clean', 'airy'] },
  { id: 'light-hollywood-three', name: 'Hollywood Three-Point', category: 'lighting', promptFragment: 'classic Hollywood three-point lighting, key fill and backlight', tags: ['hollywood', 'classic', 'professional'] },
  { id: 'light-kicker', name: 'Kicker Light', category: 'lighting', promptFragment: 'kicker light from behind-side, edge accent, separation from background', tags: ['accent', 'edge', 'separation'] },
  { id: 'light-lens-flare', name: 'Lens Flare', category: 'lighting', promptFragment: 'dramatic lens flare from bright light source, anamorphic streaks', tags: ['flare', 'dramatic', 'cinematic'] },
  { id: 'light-loop', name: 'Loop Lighting', category: 'lighting', promptFragment: 'loop lighting with small shadow under nose, classic portrait setup', tags: ['portrait', 'classic', 'flattering'] },
  { id: 'light-low-key', name: 'Low Key', category: 'lighting', promptFragment: 'low-key lighting, predominantly dark with selective highlights', tags: ['dark', 'dramatic', 'noir'] },
  { id: 'light-moonlight', name: 'Moonlight', category: 'lighting', promptFragment: 'cool blue moonlight, nighttime natural illumination, silvery', tags: ['night', 'cool', 'blue'] },
  { id: 'light-noir', name: 'Noir', category: 'lighting', promptFragment: 'film noir lighting, sharp shadows through venetian blinds, high contrast', tags: ['noir', 'shadows', 'mystery'] },
  { id: 'light-practical', name: 'Practical Lights', category: 'lighting', promptFragment: 'practical lighting from visible in-scene sources, lamps, screens, signs', tags: ['practical', 'in-scene', 'realistic'] },
  { id: 'light-product-side-key', name: 'Product Side Key', category: 'lighting', promptFragment: 'product photography side key lighting, clean highlights, controlled reflections', tags: ['product', 'commercial', 'clean'] },
  { id: 'light-ring', name: 'Ring Light', category: 'lighting', promptFragment: 'ring light catchlight in eyes, even face illumination, beauty influencer', tags: ['beauty', 'influencer', 'even'] },
  { id: 'light-rim-soft-fill', name: 'Rim and Soft Fill', category: 'lighting', promptFragment: 'rim lighting with soft frontal fill, cinematic subject separation', tags: ['rim', 'fill', 'cinematic'] },
  { id: 'light-short', name: 'Short Lighting', category: 'lighting', promptFragment: 'short lighting with shadowed side toward camera, slimming dramatic', tags: ['dramatic', 'slimming', 'portrait'] },
  { id: 'light-silhouette', name: 'Silhouette', category: 'lighting', promptFragment: 'silhouette backlighting, subject as dark shape against bright background', tags: ['silhouette', 'dramatic', 'artistic'] },
  { id: 'light-softbox', name: 'Softbox Key', category: 'lighting', promptFragment: 'softbox key lighting, large soft diffused main light, studio quality', tags: ['studio', 'soft', 'controlled'] },
  { id: 'light-split', name: 'Split Lighting', category: 'lighting', promptFragment: 'split lighting with exactly half the face lit, half in shadow', tags: ['dramatic', 'noir', 'bold'] },
  { id: 'light-stage-spotlight', name: 'Stage Spotlight', category: 'lighting', promptFragment: 'stage spotlight, pool of light in darkness, theatrical performance', tags: ['stage', 'theatrical', 'performance'] },
  { id: 'light-flat', name: 'Studio Flat', category: 'lighting', promptFragment: 'flat studio lighting, minimal shadows, even illumination, catalog style', tags: ['flat', 'even', 'commercial'] },
  { id: 'light-sunrise', name: 'Sunrise', category: 'lighting', promptFragment: 'sunrise lighting, warm orange and pink rays, long morning shadows', tags: ['sunrise', 'warm', 'morning'] },
  { id: 'light-top-down', name: 'Top Down Flat Lay', category: 'lighting', promptFragment: 'top-down flat lay lighting, even overhead illumination, product display', tags: ['flat-lay', 'overhead', 'product'] },
];

const FILM_STOCK_PRESETS: CinematicPreset[] = [
  { id: 'film-kodak-portra-400', name: 'Kodak Portra 400', category: 'filmStock', promptFragment: 'Kodak Portra 400 film, warm skin tones, pastel colors', tags: ['warm', 'portrait', 'classic'] },
  { id: 'film-fuji-pro-400h', name: 'Fuji Pro 400H', category: 'filmStock', promptFragment: 'Fujifilm Pro 400H, cool pastels, soft greens', tags: ['cool', 'pastel', 'wedding'] },
  { id: 'film-kodak-ektar', name: 'Kodak Ektar 100', category: 'filmStock', promptFragment: 'Kodak Ektar 100, vivid saturated colors, fine grain', tags: ['vivid', 'sharp', 'landscape'] },
  { id: 'film-ilford-hp5', name: 'Ilford HP5 Plus', category: 'filmStock', promptFragment: 'Ilford HP5 Plus black and white film, visible grain', tags: ['bw', 'grain', 'classic'] },
  { id: 'film-tri-x', name: 'Kodak Tri-X 400', category: 'filmStock', promptFragment: 'Kodak Tri-X 400 black and white, high contrast grain', tags: ['bw', 'contrast', 'documentary'] },
  { id: 'film-cinestill-800t', name: 'CineStill 800T', category: 'filmStock', promptFragment: 'CineStill 800T tungsten-balanced, halation glow, red highlights', tags: ['tungsten', 'halation', 'night'] },
  { id: 'film-kodachrome', name: 'Kodachrome 64', category: 'filmStock', promptFragment: 'Kodachrome 64 rich saturated reds and blues, vintage', tags: ['vintage', 'saturated', 'iconic'] },
  { id: 'film-velvia', name: 'Fuji Velvia 50', category: 'filmStock', promptFragment: 'Fuji Velvia 50 slide film, ultra-vivid hyper-saturated colors', tags: ['vivid', 'slide', 'landscape'] },
  { id: 'film-agfa-vista', name: 'Agfa Vista 200', category: 'filmStock', promptFragment: 'Agfa Vista 200 consumer film, warm tones, slightly muted, casual snapshot', tags: ['consumer', 'warm', 'casual'] },
  { id: 'film-cinestill-50d', name: 'CineStill 50D', category: 'filmStock', promptFragment: 'CineStill 50D daylight-balanced, fine grain, cinema-derived color', tags: ['daylight', 'fine-grain', 'cinema'] },
  { id: 'film-ektachrome', name: 'Ektachrome E100', category: 'filmStock', promptFragment: 'Ektachrome E100 slide film, clean saturated colors, fine grain transparency', tags: ['slide', 'saturated', 'clean'] },
  { id: 'film-fuji-acros', name: 'Fuji Acros 100', category: 'filmStock', promptFragment: 'Fuji Neopan Acros 100 B&W, ultra-fine grain, smooth tonal gradation', tags: ['bw', 'fine-grain', 'smooth'] },
  { id: 'film-fuji-superia', name: 'Fuji Superia 400', category: 'filmStock', promptFragment: 'Fuji Superia 400, green-shifted consumer film, visible grain, everyday photos', tags: ['consumer', 'green', 'grain'] },
  { id: 'film-fujicolor-pro', name: 'Fujicolor Pro 160NS', category: 'filmStock', promptFragment: 'Fujicolor Pro 160NS, natural skin tones, neutral saturation, wedding photography', tags: ['portrait', 'natural', 'wedding'] },
  { id: 'film-ilford-delta', name: 'Ilford Delta 3200', category: 'filmStock', promptFragment: 'Ilford Delta 3200, extremely high ISO B&W, heavy grain, available-light photography', tags: ['bw', 'high-iso', 'grain'] },
  { id: 'film-ilford-xp2', name: 'Ilford XP2 Super', category: 'filmStock', promptFragment: 'Ilford XP2 Super, chromogenic B&W, smooth tones, C-41 process', tags: ['bw', 'smooth', 'chromogenic'] },
  { id: 'film-kodak-gold-200', name: 'Kodak Gold 200', category: 'filmStock', promptFragment: 'Kodak Gold 200, warm golden tones, affordable classic, family photos', tags: ['warm', 'golden', 'consumer'] },
  { id: 'film-kodak-portra-160', name: 'Kodak Portra 160', category: 'filmStock', promptFragment: 'Kodak Portra 160, extremely fine grain, natural skin tones, low-contrast pastel', tags: ['fine-grain', 'portrait', 'pastel'] },
  { id: 'film-kodak-portra-800', name: 'Kodak Portra 800', category: 'filmStock', promptFragment: 'Kodak Portra 800, high-speed portrait film, visible grain, warm low-light', tags: ['high-iso', 'warm', 'portrait'] },
  { id: 'film-kodak-tmax', name: 'Kodak T-Max 100', category: 'filmStock', promptFragment: 'Kodak T-Max 100 B&W, tabular grain, extremely sharp, smooth tones', tags: ['bw', 'sharp', 'fine-grain'] },
  { id: 'film-kodak-ultramax', name: 'Kodak Ultramax 400', category: 'filmStock', promptFragment: 'Kodak Ultramax 400, punchy saturated consumer film, visible grain', tags: ['consumer', 'saturated', 'punchy'] },
  { id: 'film-kodak-vision3-50d', name: 'Kodak Vision3 50D', category: 'filmStock', promptFragment: 'Kodak Vision3 50D cinema film, daylight balanced, fine grain motion picture', tags: ['cinema', 'daylight', 'fine-grain'] },
  { id: 'film-kodak-vision3-200t', name: 'Kodak Vision3 200T', category: 'filmStock', promptFragment: 'Kodak Vision3 200T cinema film, tungsten balanced, versatile motion picture', tags: ['cinema', 'tungsten', 'versatile'] },
  { id: 'film-kodak-vision3-500t', name: 'Kodak Vision3 500T', category: 'filmStock', promptFragment: 'Kodak Vision3 500T cinema film, tungsten high-speed, Hollywood standard', tags: ['cinema', 'tungsten', 'hollywood'] },
  { id: 'film-lomo-400', name: 'Lomography Color 400', category: 'filmStock', promptFragment: 'Lomography Color Negative 400, over-saturated, unpredictable color shifts', tags: ['lomo', 'saturated', 'experimental'] },
  { id: 'film-lomo-lady-grey', name: 'Lomography Lady Grey', category: 'filmStock', promptFragment: 'Lomography Lady Grey B&W, medium contrast, soft grain, approachable monochrome', tags: ['bw', 'lomo', 'soft'] },
  { id: 'film-polaroid-600', name: 'Polaroid 600 Film', category: 'filmStock', promptFragment: 'Polaroid 600 instant film, soft edges, muted colors, square format nostalgia', tags: ['instant', 'nostalgic', 'square'] },
  { id: 'film-cinestill-400d', name: 'CineStill 400D', category: 'filmStock', promptFragment: 'CineStill 400D daylight, cinema-derived, warm highlights, versatile', tags: ['daylight', 'cinema', 'versatile'] },
  { id: 'film-fomapan', name: 'Fomapan 400', category: 'filmStock', promptFragment: 'Fomapan 400 B&W, Czech film, distinctive grain structure, retro character', tags: ['bw', 'retro', 'character'] },
];

const PHOTOGRAPHER_STYLE_PRESETS: CinematicPreset[] = [
  { id: 'photo-annie-leibovitz', name: 'Annie Leibovitz', category: 'photographerStyle', promptFragment: 'in the style of Annie Leibovitz, dramatic editorial portrait', tags: ['editorial', 'portrait', 'dramatic'] },
  { id: 'photo-peter-lindbergh', name: 'Peter Lindbergh', category: 'photographerStyle', promptFragment: 'in the style of Peter Lindbergh, raw black and white fashion', tags: ['fashion', 'bw', 'raw'] },
  { id: 'photo-helmut-newton', name: 'Helmut Newton', category: 'photographerStyle', promptFragment: 'in the style of Helmut Newton, provocative high-contrast fashion', tags: ['fashion', 'bold', 'contrast'] },
  { id: 'photo-ansel-adams', name: 'Ansel Adams', category: 'photographerStyle', promptFragment: 'in the style of Ansel Adams, dramatic landscape zone system', tags: ['landscape', 'bw', 'zone-system'] },
  { id: 'photo-steve-mccurry', name: 'Steve McCurry', category: 'photographerStyle', promptFragment: 'in the style of Steve McCurry, vivid documentary portrait', tags: ['documentary', 'vivid', 'portrait'] },
  { id: 'photo-fan-ho', name: 'Fan Ho', category: 'photographerStyle', promptFragment: 'in the style of Fan Ho, geometric light and shadow street photography', tags: ['street', 'geometric', 'shadow'] },
  { id: 'photo-mario-testino', name: 'Mario Testino', category: 'photographerStyle', promptFragment: 'in the style of Mario Testino, glamorous sun-drenched fashion', tags: ['fashion', 'glamour', 'warm'] },
  { id: 'photo-vivian-maier', name: 'Vivian Maier', category: 'photographerStyle', promptFragment: 'in the style of Vivian Maier, candid intimate street photography', tags: ['street', 'candid', 'intimate'] },
  { id: 'photo-7th-era', name: '7th Era', category: 'photographerStyle', promptFragment: 'in the style of 7th Era, moody cinematic portraiture, film-inspired', tags: ['cinematic', 'moody', 'film'] },
  { id: 'photo-alberto-seveso', name: 'Alberto Seveso', category: 'photographerStyle', promptFragment: 'in the style of Alberto Seveso, underwater ink photography, vibrant fluid abstract', tags: ['abstract', 'underwater', 'vibrant'] },
  { id: 'photo-alec-soth', name: 'Alec Soth', category: 'photographerStyle', promptFragment: 'in the style of Alec Soth, American landscape documentary, poetic Midwest', tags: ['documentary', 'american', 'poetic'] },
  { id: 'photo-alex-strohl', name: 'Alex Strohl', category: 'photographerStyle', promptFragment: 'in the style of Alex Strohl, adventurous natural landscape, warm golden outdoor', tags: ['adventure', 'landscape', 'golden'] },
  { id: 'photo-alex-webb', name: 'Alex Webb', category: 'photographerStyle', promptFragment: 'in the style of Alex Webb, complex layered street photography, vivid color and shadow', tags: ['street', 'layered', 'vivid'] },
  { id: 'photo-alfred-stieglitz', name: 'Alfred Stieglitz', category: 'photographerStyle', promptFragment: 'in the style of Alfred Stieglitz, pioneering fine art photography, cloud studies', tags: ['fine-art', 'pioneer', 'clouds'] },
  { id: 'photo-alin-palander', name: 'Alin Palander', category: 'photographerStyle', promptFragment: 'in the style of Alin Palander, moody Nordic landscape, dark atmospheric', tags: ['nordic', 'moody', 'dark'] },
  { id: 'photo-ando-fuchs', name: 'Ando Fuchs', category: 'photographerStyle', promptFragment: 'in the style of Ando Fuchs, dramatic chiaroscuro portraiture, Austrian fine art', tags: ['portrait', 'chiaroscuro', 'fine-art'] },
  { id: 'photo-brandon-woelfel', name: 'Brandon Woelfel', category: 'photographerStyle', promptFragment: 'in the style of Brandon Woelfel, fairy light bokeh portraits, warm neon glow', tags: ['bokeh', 'fairy-light', 'warm'] },
  { id: 'photo-chris-burkard', name: 'Chris Burkard', category: 'photographerStyle', promptFragment: 'in the style of Chris Burkard, epic adventure landscape, surf and wilderness', tags: ['adventure', 'epic', 'surf'] },
  { id: 'photo-gregory-crewdson', name: 'Gregory Crewdson', category: 'photographerStyle', promptFragment: 'in the style of Gregory Crewdson, cinematic suburban tableaux, elaborate staging', tags: ['cinematic', 'suburban', 'staged'] },
  { id: 'photo-henri-cartier-bresson', name: 'Henri Cartier-Bresson', category: 'photographerStyle', promptFragment: 'in the style of Henri Cartier-Bresson, decisive moment street photography, geometric B&W', tags: ['street', 'decisive', 'geometric'] },
  { id: 'photo-north-borders', name: 'North Borders', category: 'photographerStyle', promptFragment: 'in the style of North Borders, ethereal landscape photography, atmospheric Nordic', tags: ['ethereal', 'landscape', 'nordic'] },
];

const MOVIE_LOOK_PRESETS: CinematicPreset[] = [
  { id: 'movie-blade-runner', name: 'Blade Runner 2049', category: 'movieLook', promptFragment: 'Blade Runner 2049 color grade, orange and teal, hazy atmosphere', tags: ['sci-fi', 'orange-teal', 'atmospheric'] },
  { id: 'movie-wes-anderson', name: 'Wes Anderson', category: 'movieLook', promptFragment: 'Wes Anderson symmetrical composition, pastel color palette', tags: ['symmetry', 'pastel', 'whimsical'] },
  { id: 'movie-dark-knight', name: 'The Dark Knight', category: 'movieLook', promptFragment: 'The Dark Knight IMAX look, desaturated cool tones, gritty', tags: ['dark', 'gritty', 'desaturated'] },
  { id: 'movie-mad-max', name: 'Mad Max: Fury Road', category: 'movieLook', promptFragment: 'Mad Max Fury Road color grade, teal shadows orange highlights', tags: ['action', 'teal-orange', 'intense'] },
  { id: 'movie-matrix', name: 'The Matrix', category: 'movieLook', promptFragment: 'The Matrix green-tinted cyberpunk color grade', tags: ['green', 'cyberpunk', 'tech'] },
  { id: 'movie-moonlight', name: 'Moonlight', category: 'movieLook', promptFragment: 'Moonlight cinematography, blue-purple intimate lighting', tags: ['intimate', 'blue', 'emotional'] },
  { id: 'movie-godfather', name: 'The Godfather', category: 'movieLook', promptFragment: 'The Godfather warm amber sepia-toned chiaroscuro lighting', tags: ['classic', 'warm', 'chiaroscuro'] },
  { id: 'movie-her', name: 'Her', category: 'movieLook', promptFragment: 'Her warm soft pastel palette, dreamy intimate atmosphere', tags: ['warm', 'soft', 'romantic'] },
  { id: 'movie-dune', name: 'Dune', category: 'movieLook', promptFragment: 'Dune desaturated warm desert tones, epic scale cinematography', tags: ['epic', 'desert', 'deakins'] },
  { id: 'movie-annihilation', name: 'Annihilation', category: 'movieLook', promptFragment: 'Annihilation iridescent alien color shifts, prismatic otherworldly light', tags: ['sci-fi', 'alien', 'iridescent'] },
  { id: 'movie-apocalypse-now', name: 'Apocalypse Now', category: 'movieLook', promptFragment: 'Apocalypse Now humid jungle green and orange firelight, Vietnam war fever dream', tags: ['war', 'jungle', 'surreal'] },
  { id: 'movie-arrival', name: 'Arrival', category: 'movieLook', promptFragment: 'Arrival cold grey overcast tones, muted desaturated, contemplative atmosphere', tags: ['sci-fi', 'grey', 'contemplative'] },
  { id: 'movie-avatar', name: 'Avatar', category: 'movieLook', promptFragment: 'Avatar bioluminescent blue and green alien jungle, vivid saturated fantasy', tags: ['fantasy', 'blue', 'bioluminescent'] },
  { id: 'movie-back-to-future', name: 'Back to the Future', category: 'movieLook', promptFragment: 'Back to the Future warm 80s Spielberg glow, suburban Americana, adventure', tags: ['80s', 'adventure', 'warm'] },
  { id: 'movie-barry-lyndon', name: 'Barry Lyndon', category: 'movieLook', promptFragment: 'Barry Lyndon candlelight photography, natural light only, 18th century painting', tags: ['candlelight', 'period', 'kubrick'] },
  { id: 'movie-beetlejuice', name: 'Beetlejuice', category: 'movieLook', promptFragment: 'Beetlejuice Tim Burton gothic whimsy, saturated greens and purples, surreal', tags: ['gothic', 'whimsical', 'burton'] },
  { id: 'movie-ben-hur', name: 'Ben-Hur 1959', category: 'movieLook', promptFragment: 'Ben-Hur 1959 Technicolor epic, rich saturated primary colors, widescreen grandeur', tags: ['epic', 'technicolor', 'classic'] },
  { id: 'movie-black-hawk-down', name: 'Black Hawk Down', category: 'movieLook', promptFragment: 'Black Hawk Down bleached desaturated war zone, high contrast, handheld chaos', tags: ['war', 'desaturated', 'intense'] },
  { id: 'movie-casino-royale', name: 'Casino Royale', category: 'movieLook', promptFragment: 'Casino Royale cold teal and steel blue, high contrast espionage thriller', tags: ['thriller', 'cold', 'sleek'] },
  { id: 'movie-casablanca', name: 'Casablanca', category: 'movieLook', promptFragment: 'Casablanca classic Hollywood black and white, soft focus glamour, film noir', tags: ['bw', 'classic', 'glamour'] },
  { id: 'movie-children-of-men', name: 'Children of Men', category: 'movieLook', promptFragment: 'Children of Men gritty documentary realism, muted grey-green, long takes', tags: ['dystopia', 'gritty', 'documentary'] },
  { id: 'movie-chinatown', name: 'Chinatown', category: 'movieLook', promptFragment: 'Chinatown warm amber noir, 1930s Los Angeles, golden afternoon haze', tags: ['noir', 'warm', 'classic'] },
  { id: 'movie-city-of-god', name: 'City of God', category: 'movieLook', promptFragment: 'City of God vibrant oversaturated Brazilian favela, golden warmth, raw energy', tags: ['vibrant', 'warm', 'gritty'] },
  { id: 'movie-collateral', name: 'Collateral', category: 'movieLook', promptFragment: 'Collateral digital night photography, LA nightscape, cool blue sodium vapor', tags: ['night', 'digital', 'urban'] },
  { id: 'movie-crouching-tiger', name: 'Crouching Tiger', category: 'movieLook', promptFragment: 'Crouching Tiger Hidden Dragon lush green bamboo forests, painterly wuxia', tags: ['wuxia', 'green', 'painterly'] },
  { id: 'movie-django', name: 'Django Unchained', category: 'movieLook', promptFragment: 'Django Unchained warm saturated Western, Tarantino rich reds and browns', tags: ['western', 'warm', 'saturated'] },
  { id: 'movie-drive', name: 'Drive', category: 'movieLook', promptFragment: 'Drive neon-soaked LA nights, pink and cyan, synthwave retro-modern', tags: ['synthwave', 'neon', 'retro'] },
  { id: 'movie-eternal-sunshine', name: 'Eternal Sunshine', category: 'movieLook', promptFragment: 'Eternal Sunshine of the Spotless Mind dreamy desaturated surreal memory', tags: ['dreamy', 'surreal', 'memory'] },
  { id: 'movie-everything-everywhere', name: 'Everything Everywhere', category: 'movieLook', promptFragment: 'Everything Everywhere All at Once chaotic multiverse colors, vivid eclectic', tags: ['vivid', 'chaotic', 'multiverse'] },
  { id: 'movie-fight-club', name: 'Fight Club', category: 'movieLook', promptFragment: 'Fight Club dingy green-yellow underground grime, Fincher dark desaturation', tags: ['grungy', 'dark', 'fincher'] },
  { id: 'movie-ghost-in-shell', name: 'Ghost in the Shell', category: 'movieLook', promptFragment: 'Ghost in the Shell cyberpunk neon cityscape, holographic blue and orange', tags: ['cyberpunk', 'anime', 'neon'] },
  { id: 'movie-gladiator', name: 'Gladiator', category: 'movieLook', promptFragment: 'Gladiator warm amber Roman arena, desaturated action, epic ancient world', tags: ['epic', 'ancient', 'warm'] },
  { id: 'movie-gone-girl', name: 'Gone Girl', category: 'movieLook', promptFragment: 'Gone Girl cold clinical suburban dread, sterile blue-green, Fincher precision', tags: ['cold', 'clinical', 'thriller'] },
  { id: 'movie-grand-budapest', name: 'Grand Budapest Hotel', category: 'movieLook', promptFragment: 'Grand Budapest Hotel pastel pink and purple, symmetrical dollhouse, whimsical', tags: ['pastel', 'symmetrical', 'whimsical'] },
  { id: 'movie-inception', name: 'Inception', category: 'movieLook', promptFragment: 'Inception cool blue-grey dreamscape, sharp modern architecture, layered reality', tags: ['cool', 'modern', 'cerebral'] },
  { id: 'movie-interstellar', name: 'Interstellar', category: 'movieLook', promptFragment: 'Interstellar vast cosmic scale, warm golden farmland to cold space void', tags: ['space', 'epic', 'nolan'] },
  { id: 'movie-john-wick', name: 'John Wick', category: 'movieLook', promptFragment: 'John Wick neon-lit nightclub, rich deep shadows, high contrast action noir', tags: ['neon', 'action', 'noir'] },
  { id: 'movie-joker', name: 'Joker', category: 'movieLook', promptFragment: 'Joker grimy 1980s New York, warm gritty yellows and greens, character study', tags: ['gritty', '80s', 'character'] },
  { id: 'movie-kill-bill', name: 'Kill Bill', category: 'movieLook', promptFragment: 'Kill Bill hyper-stylized saturated primary colors, Tarantino pop art violence', tags: ['stylized', 'saturated', 'tarantino'] },
  { id: 'movie-la-la-land', name: 'La La Land', category: 'movieLook', promptFragment: 'La La Land magic hour golden glow, Technicolor nostalgia, musical dreaminess', tags: ['golden', 'musical', 'romantic'] },
  { id: 'movie-lawrence-arabia', name: 'Lawrence of Arabia', category: 'movieLook', promptFragment: 'Lawrence of Arabia vast desert 70mm, golden sand, epic horizon, Lean grandeur', tags: ['epic', 'desert', '70mm'] },
  { id: 'movie-lord-of-rings', name: 'Lord of the Rings', category: 'movieLook', promptFragment: 'Lord of the Rings New Zealand epic fantasy, warm Shire green to cold Mordor', tags: ['fantasy', 'epic', 'adventure'] },
  { id: 'movie-lost-translation', name: 'Lost in Translation', category: 'movieLook', promptFragment: 'Lost in Translation soft neon Tokyo nights, pastel loneliness, ambient glow', tags: ['ambient', 'neon', 'melancholic'] },
  { id: 'movie-no-country', name: 'No Country for Old Men', category: 'movieLook', promptFragment: 'No Country for Old Men stark Texas desert, bleached sunlight, Coens precision', tags: ['desert', 'stark', 'thriller'] },
  { id: 'movie-nope', name: 'Nope', category: 'movieLook', promptFragment: 'Nope clear daylight horror, Hoyte van Hoytema blue skies, analog IMAX', tags: ['horror', 'daylight', 'imax'] },
  { id: 'movie-oldboy', name: 'Oldboy', category: 'movieLook', promptFragment: 'Oldboy green-tinged Korean revenge thriller, harsh fluorescent, claustrophobic', tags: ['thriller', 'green', 'korean'] },
  { id: 'movie-oppenheimer', name: 'Oppenheimer', category: 'movieLook', promptFragment: 'Oppenheimer IMAX black and white and vivid color, sharp contrast, documentary', tags: ['imax', 'bw', 'historical'] },
  { id: 'movie-pans-labyrinth', name: "Pan's Labyrinth", category: 'movieLook', promptFragment: "Pan's Labyrinth dark fairy tale amber and deep blue, Guillermo del Toro gothic", tags: ['fantasy', 'gothic', 'dark'] },
  { id: 'movie-parasite', name: 'Parasite', category: 'movieLook', promptFragment: 'Parasite clean modern Korean cinematography, natural light, class contrast', tags: ['korean', 'clean', 'modern'] },
  { id: 'movie-pulp-fiction', name: 'Pulp Fiction', category: 'movieLook', promptFragment: 'Pulp Fiction warm retro 90s color, diner amber, Tarantino pop culture', tags: ['retro', '90s', 'tarantino'] },
  { id: 'movie-saving-private-ryan', name: 'Saving Private Ryan', category: 'movieLook', promptFragment: 'Saving Private Ryan bleached desaturated WWII, handheld combat realism', tags: ['war', 'desaturated', 'handheld'] },
  { id: 'movie-schindlers-list', name: "Schindler's List", category: 'movieLook', promptFragment: "Schindler's List stark black and white, documentary historical, single red accent", tags: ['bw', 'historical', 'documentary'] },
  { id: 'movie-se7en', name: 'Se7en', category: 'movieLook', promptFragment: 'Se7en dark rain-soaked green-brown desaturation, Fincher bleach bypass', tags: ['dark', 'rain', 'thriller'] },
  { id: 'movie-sicario', name: 'Sicario', category: 'movieLook', promptFragment: 'Sicario dust-choked desert amber, thermal haze, Deakins silhouette sunset', tags: ['desert', 'amber', 'deakins'] },
  { id: 'movie-sin-city', name: 'Sin City', category: 'movieLook', promptFragment: 'Sin City high contrast black and white with selective color pop, graphic noir', tags: ['bw', 'graphic', 'noir'] },
  { id: 'movie-social-network', name: 'Social Network', category: 'movieLook', promptFragment: 'Social Network Fincher cold blue-green digital precision, institutional sterile', tags: ['cold', 'digital', 'fincher'] },
  { id: 'movie-spider-verse', name: 'Spider-Verse', category: 'movieLook', promptFragment: 'Spider-Verse comic book halftone dots, mixed media animation, dynamic panels', tags: ['animation', 'comic', 'dynamic'] },
  { id: 'movie-stalker', name: 'Stalker (Tarkovsky)', category: 'movieLook', promptFragment: 'Stalker sepia to lush green Zone, Tarkovsky long take, water and decay', tags: ['art-house', 'sepia', 'tarkovsky'] },
  { id: 'movie-star-wars', name: 'Star Wars', category: 'movieLook', promptFragment: 'Star Wars warm golden desert to cold blue space, classic adventure color grade', tags: ['space', 'adventure', 'classic'] },
  { id: 'movie-stranger-things', name: 'Stranger Things', category: 'movieLook', promptFragment: 'Stranger Things 80s amber nostalgia, dark Upside Down blue, synth horror', tags: ['80s', 'nostalgia', 'horror'] },
  { id: 'movie-succession', name: 'Succession', category: 'movieLook', promptFragment: 'Succession handheld documentary luxury, cold New York grey, muted wealth', tags: ['documentary', 'luxury', 'cold'] },
  { id: 'movie-taxi-driver', name: 'Taxi Driver', category: 'movieLook', promptFragment: 'Taxi Driver gritty 70s New York neon, red-soaked night, paranoid isolation', tags: ['70s', 'gritty', 'noir'] },
  { id: 'movie-the-batman', name: 'The Batman 2022', category: 'movieLook', promptFragment: 'The Batman 2022 rain-drenched red and black, extreme darkness, gothic Gotham', tags: ['dark', 'red', 'gothic'] },
  { id: 'movie-the-lighthouse', name: 'The Lighthouse', category: 'movieLook', promptFragment: 'The Lighthouse harsh black and white, 1.19:1 aspect ratio, madness and isolation', tags: ['bw', 'narrow', 'horror'] },
  { id: 'movie-the-northman', name: 'The Northman', category: 'movieLook', promptFragment: 'The Northman cold Viking blue-grey, firelight amber, brutal ancient world', tags: ['cold', 'ancient', 'brutal'] },
  { id: 'movie-the-revenant', name: 'The Revenant', category: 'movieLook', promptFragment: 'The Revenant natural light only, cold wilderness blue, Chivo Lubezki long take', tags: ['natural-light', 'cold', 'wilderness'] },
  { id: 'movie-the-shining', name: 'The Shining', category: 'movieLook', promptFragment: 'The Shining Kubrick symmetry, cold hotel hallway fluorescent, dread atmosphere', tags: ['horror', 'symmetrical', 'kubrick'] },
  { id: 'movie-the-witch', name: 'The Witch', category: 'movieLook', promptFragment: 'The Witch muted colonial grey-brown, natural candlelight, 17th century dread', tags: ['horror', 'muted', 'period'] },
  { id: 'movie-there-will-be-blood', name: 'There Will Be Blood', category: 'movieLook', promptFragment: 'There Will Be Blood dusty amber oil fields, warm golden industrial, epic drama', tags: ['epic', 'amber', 'industrial'] },
  { id: 'movie-tron-legacy', name: 'Tron Legacy', category: 'movieLook', promptFragment: 'Tron Legacy neon blue and orange digital grid, black void, cybernetic glow', tags: ['digital', 'neon', 'cybernetic'] },
  { id: 'movie-uncut-gems', name: 'Uncut Gems', category: 'movieLook', promptFragment: 'Uncut Gems frenetic neon anxiety, Safdie brothers handheld chaos, oversaturated', tags: ['frenetic', 'neon', 'anxiety'] },
  { id: 'movie-vertigo', name: 'Vertigo', category: 'movieLook', promptFragment: 'Vertigo Hitchcock green and red obsession, dreamlike VistaVision, spiraling', tags: ['hitchcock', 'green-red', 'obsession'] },
  { id: 'movie-whiplash', name: 'Whiplash', category: 'movieLook', promptFragment: 'Whiplash amber jazz club warmth, tight close-ups, sweat and intensity', tags: ['warm', 'intense', 'music'] },
  { id: 'movie-memento', name: 'Memento', category: 'movieLook', promptFragment: 'Memento Polaroid color and stark B&W alternating, fragmented memory palette', tags: ['fragmented', 'bw', 'thriller'] },
  { id: 'movie-requiem', name: 'Requiem for a Dream', category: 'movieLook', promptFragment: 'Requiem for a Dream oversaturated to bleached spiral, split screen, decay', tags: ['dark', 'oversaturated', 'decay'] },
  { id: 'movie-gravity', name: 'Gravity', category: 'movieLook', promptFragment: 'Gravity Earth blue glow against void black, single-source orbital lighting', tags: ['space', 'blue', 'isolation'] },
  { id: 'movie-life-of-pi', name: 'Life of Pi', category: 'movieLook', promptFragment: 'Life of Pi vivid ocean blue and golden sunset, magical realism, painterly sea', tags: ['vivid', 'ocean', 'magical'] },
  { id: 'movie-logan', name: 'Logan', category: 'movieLook', promptFragment: 'Logan desaturated dusty brown Western, stripped-back superhero, raw gritty', tags: ['western', 'gritty', 'desaturated'] },
  { id: 'movie-manchester', name: 'Manchester by the Sea', category: 'movieLook', promptFragment: 'Manchester by the Sea cold New England grey, muted winter, quiet grief', tags: ['cold', 'muted', 'quiet'] },
  { id: 'movie-midnight-paris', name: 'Midnight in Paris', category: 'movieLook', promptFragment: 'Midnight in Paris warm golden Parisian glow, romantic amber street lights', tags: ['warm', 'romantic', 'paris'] },
  { id: 'movie-mission-impossible', name: 'Mission Impossible Fallout', category: 'movieLook', promptFragment: 'Mission Impossible Fallout sharp IMAX action, teal-orange blockbuster color', tags: ['action', 'imax', 'blockbuster'] },
  { id: 'movie-mulholland', name: 'Mulholland Drive', category: 'movieLook', promptFragment: 'Mulholland Drive Lynch dreamlike Hollywood noir, saturated reds and deep blue', tags: ['noir', 'dreamlike', 'lynch'] },
  { id: 'movie-prisoners', name: 'Prisoners', category: 'movieLook', promptFragment: 'Prisoners cold rainy Pennsylvania grey, Deakins overcast gloom, suspenseful', tags: ['cold', 'rain', 'suspense'] },
  { id: 'movie-raging-bull', name: 'Raging Bull', category: 'movieLook', promptFragment: 'Raging Bull high contrast black and white, boxing ring spotlight, Scorsese raw', tags: ['bw', 'sports', 'raw'] },
  { id: 'movie-rear-window', name: 'Rear Window', category: 'movieLook', promptFragment: 'Rear Window warm Technicolor voyeuristic framing, apartment courtyard, Hitchcock', tags: ['voyeuristic', 'warm', 'hitchcock'] },
  { id: 'movie-under-the-skin', name: 'Under the Skin', category: 'movieLook', promptFragment: 'Under the Skin cold Scottish grey, alien void black, eerie minimalism', tags: ['cold', 'alien', 'minimalist'] },
  { id: 'movie-wonka', name: 'Wonka', category: 'movieLook', promptFragment: 'Wonka vibrant candy-colored fantasy, warm chocolate browns, whimsical saturation', tags: ['whimsical', 'colorful', 'fantasy'] },
  { id: 'movie-zero-dark-thirty', name: 'Zero Dark Thirty', category: 'movieLook', promptFragment: 'Zero Dark Thirty desaturated military green-grey, night vision green, operational', tags: ['military', 'desaturated', 'thriller'] },
  { id: 'movie-once-upon-hollywood', name: 'Once Upon a Time in Hollywood', category: 'movieLook', promptFragment: 'Once Upon a Time in Hollywood golden 1969 LA sunshine, warm vintage Kodak', tags: ['60s', 'warm', 'tarantino'] },
];

const FILTER_PRESETS: CinematicPreset[] = [
  { id: 'filter-grain', name: 'Film Grain', category: 'filter', promptFragment: 'with visible film grain texture', tags: ['grain', 'texture', 'analog'] },
  { id: 'filter-vignette', name: 'Vignette', category: 'filter', promptFragment: 'with dark vignette edges', tags: ['vignette', 'focus', 'classic'] },
  { id: 'filter-haze', name: 'Atmospheric Haze', category: 'filter', promptFragment: 'with atmospheric haze and diffusion', tags: ['haze', 'diffusion', 'dreamy'] },
  { id: 'filter-chromatic', name: 'Chromatic Aberration', category: 'filter', promptFragment: 'with subtle chromatic aberration fringing', tags: ['aberration', 'lo-fi', 'analog'] },
  { id: 'filter-bloom', name: 'Bloom / Glow', category: 'filter', promptFragment: 'with soft bloom glow on highlights', tags: ['bloom', 'glow', 'dreamy'] },
  { id: 'filter-light-leak', name: 'Light Leak', category: 'filter', promptFragment: 'with warm light leak effect', tags: ['leak', 'vintage', 'warm'] },
  { id: 'filter-duotone', name: 'Duotone', category: 'filter', promptFragment: 'duotone two-color effect', tags: ['duotone', 'graphic', 'stylized'] },
  { id: 'filter-desaturated', name: 'Desaturated', category: 'filter', promptFragment: 'desaturated muted colors', tags: ['desaturated', 'muted', 'moody'] },
  { id: 'filter-high-contrast', name: 'High Contrast', category: 'filter', promptFragment: 'high contrast deep blacks bright highlights', tags: ['contrast', 'bold', 'dramatic'] },
  { id: 'filter-cross-process', name: 'Cross-Process', category: 'filter', promptFragment: 'cross-processed color shift effect', tags: ['cross-process', 'shift', 'experimental'] },
  { id: 'filter-bw', name: 'Black and White', category: 'filter', promptFragment: 'black and white photography, monochrome, grayscale', tags: ['bw', 'monochrome', 'classic'] },
  { id: 'filter-bokeh', name: 'Bokeh', category: 'filter', promptFragment: 'beautiful bokeh circles of confusion, out-of-focus highlights', tags: ['bokeh', 'depth', 'dreamy'] },
  { id: 'filter-collage', name: 'Collage Cutout', category: 'filter', promptFragment: 'collage cutout mixed media effect, paper texture overlay', tags: ['collage', 'mixed-media', 'artistic'] },
  { id: 'filter-warm', name: 'Color Filter (Warm)', category: 'filter', promptFragment: 'warm amber color filter, orange-toned, sunset warmth', tags: ['warm', 'amber', 'orange'] },
  { id: 'filter-cool', name: 'Color Filter (Cool)', category: 'filter', promptFragment: 'cool blue color filter, blue-toned, cold atmosphere', tags: ['cool', 'blue', 'cold'] },
  { id: 'filter-vintage', name: 'Color Filter (Vintage)', category: 'filter', promptFragment: 'vintage faded color filter, muted yellowed aging effect', tags: ['vintage', 'faded', 'aged'] },
  { id: 'filter-crt', name: 'CRT Scanlines', category: 'filter', promptFragment: 'CRT monitor scanlines, retro screen display effect', tags: ['crt', 'retro', 'digital'] },
  { id: 'filter-cyanotype', name: 'Cyanotype', category: 'filter', promptFragment: 'cyanotype blue print photographic process, Prussian blue tones', tags: ['cyanotype', 'blue', 'alternative'] },
  { id: 'filter-datamosh', name: 'Datamosh Glitch', category: 'filter', promptFragment: 'datamosh pixel smearing glitch art, corrupted video frames', tags: ['glitch', 'digital', 'corrupted'] },
  { id: 'filter-desaturated-grunge', name: 'Desaturated Grunge', category: 'filter', promptFragment: 'desaturated grunge texture overlay, worn dirty scratched surface', tags: ['grunge', 'texture', 'worn'] },
  { id: 'filter-double-exposure', name: 'Double Exposure', category: 'filter', promptFragment: 'double exposure layered photographs, two images blended together', tags: ['double', 'blend', 'artistic'] },
  { id: 'filter-film-burn', name: 'Film Burn', category: 'filter', promptFragment: 'film burn bright overexposed edges, orange and white light damage', tags: ['film', 'burn', 'damage'] },
  { id: 'filter-grain-heavy', name: 'Film Grain (Heavy)', category: 'filter', promptFragment: 'heavy prominent film grain, coarse grain texture, high ISO look', tags: ['grain', 'coarse', 'gritty'] },
  { id: 'filter-glitch', name: 'Glitch Style', category: 'filter', promptFragment: 'digital glitch artifacts, RGB shift, horizontal tearing', tags: ['glitch', 'digital', 'rgb'] },
  { id: 'filter-hdr', name: 'HDR Tone Mapping', category: 'filter', promptFragment: 'HDR tone mapping, extended dynamic range, detail in shadows and highlights', tags: ['hdr', 'dynamic-range', 'detail'] },
  { id: 'filter-halftone', name: 'Halftone', category: 'filter', promptFragment: 'halftone dot pattern, newspaper print style, Ben-Day dots', tags: ['halftone', 'print', 'graphic'] },
  { id: 'filter-ice-mist', name: 'Ice Mist Filter', category: 'filter', promptFragment: 'ice mist diffusion filter, soft ethereal glow, dreamy highlights', tags: ['diffusion', 'ethereal', 'soft'] },
  { id: 'filter-infrared', name: 'Infrared', category: 'filter', promptFragment: 'infrared photography, white foliage, dark skies, false color thermal', tags: ['infrared', 'false-color', 'surreal'] },
  { id: 'filter-kaleidoscope', name: 'Kaleidoscope', category: 'filter', promptFragment: 'kaleidoscope mirror reflection symmetry, prismatic fragmented view', tags: ['kaleidoscope', 'symmetry', 'prismatic'] },
  { id: 'filter-lens-flare', name: 'Lens Flare', category: 'filter', promptFragment: 'anamorphic lens flare streaks, light hitting lens directly', tags: ['flare', 'anamorphic', 'cinematic'] },
  { id: 'filter-lomo', name: 'Lomography', category: 'filter', promptFragment: 'lomography effect, heavy vignette, over-saturated colors, light leaks', tags: ['lomo', 'vignette', 'saturated'] },
  { id: 'filter-miniature', name: 'Miniature / Tilt-Shift', category: 'filter', promptFragment: 'tilt-shift miniature effect, selective focus band, toy model appearance', tags: ['tilt-shift', 'miniature', 'toy'] },
  { id: 'filter-motion-blur', name: 'Motion Blur', category: 'filter', promptFragment: 'motion blur streak, movement captured, dynamic speed effect', tags: ['motion', 'speed', 'dynamic'] },
  { id: 'filter-negative', name: 'Negative Invert', category: 'filter', promptFragment: 'photographic negative inverted colors, reversed tones', tags: ['negative', 'inverted', 'experimental'] },
  { id: 'filter-oil-paint', name: 'Oil Paint Filter', category: 'filter', promptFragment: 'oil paint filter, thick brushstroke texture, painterly smoothing', tags: ['paint', 'brushstroke', 'artistic'] },
  { id: 'filter-overexposed', name: 'Overexposed', category: 'filter', promptFragment: 'overexposed blown-out highlights, bright airy washed-out look', tags: ['overexposed', 'bright', 'airy'] },
  { id: 'filter-pixelate', name: 'Pixelate', category: 'filter', promptFragment: 'pixelated mosaic effect, large visible pixels, retro digital', tags: ['pixel', 'mosaic', 'retro'] },
  { id: 'filter-posterize', name: 'Posterize', category: 'filter', promptFragment: 'posterized limited color palette, flat color bands, graphic design', tags: ['posterize', 'flat', 'graphic'] },
  { id: 'filter-prism', name: 'Prism Rainbow', category: 'filter', promptFragment: 'prism rainbow light refraction, spectrum colors across frame', tags: ['prism', 'rainbow', 'spectrum'] },
  { id: 'filter-sepia', name: 'Sepia Tone', category: 'filter', promptFragment: 'sepia toned warm brown vintage photograph effect', tags: ['sepia', 'vintage', 'brown'] },
  { id: 'filter-solarize', name: 'Solarize', category: 'filter', promptFragment: 'solarization Man Ray effect, partially inverted tones, surreal', tags: ['solarize', 'surreal', 'experimental'] },
  { id: 'filter-split-tone', name: 'Split Toning', category: 'filter', promptFragment: 'split toning warm highlights cool shadows, dual-tone color grade', tags: ['split-tone', 'dual-color', 'grade'] },
  { id: 'filter-underexposed', name: 'Underexposed', category: 'filter', promptFragment: 'underexposed dark moody, crushed shadows, low-key darkness', tags: ['underexposed', 'dark', 'moody'] },
  { id: 'filter-vhs', name: 'VHS Distortion', category: 'filter', promptFragment: 'VHS tape distortion, tracking errors, analog video noise', tags: ['vhs', 'analog', 'distortion'] },
  { id: 'filter-watercolor', name: 'Watercolor Filter', category: 'filter', promptFragment: 'watercolor filter effect, soft edges bleeding colors, paper texture', tags: ['watercolor', 'soft', 'artistic'] },
];

const ART_STYLE_PRESETS: CinematicPreset[] = [
  { id: 'art-photorealistic', name: 'Photorealistic', category: 'artStyle', promptFragment: 'photorealistic, hyper-detailed', tags: ['realistic', 'photo', 'detailed'] },
  { id: 'art-pixar', name: 'Pixar / 3D', category: 'artStyle', promptFragment: 'Pixar-style 3D animated character render', tags: ['3d', 'animated', 'pixar'] },
  { id: 'art-anime', name: 'Anime', category: 'artStyle', promptFragment: 'anime illustration style, cel-shaded', tags: ['anime', 'japanese', 'cel-shaded'] },
  { id: 'art-comic', name: 'Comic Book', category: 'artStyle', promptFragment: 'comic book art style with ink outlines and halftone dots', tags: ['comic', 'ink', 'halftone'] },
  { id: 'art-watercolor', name: 'Watercolor', category: 'artStyle', promptFragment: 'delicate watercolor painting style with visible brushstrokes', tags: ['watercolor', 'painting', 'delicate'] },
  { id: 'art-oil-painting', name: 'Oil Painting', category: 'artStyle', promptFragment: 'classical oil painting style with rich impasto texture', tags: ['oil', 'painting', 'classical'] },
  { id: 'art-cyberpunk', name: 'Cyberpunk', category: 'artStyle', promptFragment: 'cyberpunk aesthetic, neon-lit, chrome and glass', tags: ['cyberpunk', 'neon', 'futuristic'] },
  { id: 'art-fantasy', name: 'Fantasy Art', category: 'artStyle', promptFragment: 'epic fantasy art style, magical atmosphere', tags: ['fantasy', 'magical', 'epic'] },
  { id: 'art-noir', name: 'Film Noir', category: 'artStyle', promptFragment: 'film noir style, high contrast black and white, dramatic shadows', tags: ['noir', 'bw', 'shadows'] },
  { id: 'art-pop-art', name: 'Pop Art', category: 'artStyle', promptFragment: 'pop art style, bold colors, Ben-Day dots', tags: ['pop', 'bold', 'warhol'] },
  { id: 'art-minimalist', name: 'Minimalist', category: 'artStyle', promptFragment: 'minimalist clean design, negative space', tags: ['minimal', 'clean', 'simple'] },
  { id: 'art-surreal', name: 'Surrealist', category: 'artStyle', promptFragment: 'surrealist dreamlike composition in the style of Dali', tags: ['surreal', 'dream', 'dali'] },
  { id: 'art-ghibli', name: 'Anime (Ghibli)', category: 'artStyle', promptFragment: 'Studio Ghibli anime style, hand-drawn, lush landscapes, Miyazaki aesthetic', tags: ['ghibli', 'miyazaki', 'hand-drawn'] },
  { id: 'art-shinkai', name: 'Anime (Makoto Shinkai)', category: 'artStyle', promptFragment: 'Makoto Shinkai anime style, photorealistic skies, sparkling light particles', tags: ['shinkai', 'detailed', 'skies'] },
  { id: 'art-shonen', name: 'Anime (Shonen)', category: 'artStyle', promptFragment: 'shonen anime style, dynamic action poses, speed lines, bold outlines', tags: ['shonen', 'action', 'dynamic'] },
  { id: 'art-manga', name: 'Comic Book (Manga)', category: 'artStyle', promptFragment: 'manga illustration style, screentone shading, expressive linework', tags: ['manga', 'japanese', 'linework'] },
  { id: 'art-digital-illustration', name: 'Digital Illustration', category: 'artStyle', promptFragment: 'polished digital illustration, clean lines, vibrant color palette', tags: ['digital', 'polished', 'clean'] },
  { id: 'art-low-poly', name: 'Low-Poly 3D', category: 'artStyle', promptFragment: 'low-poly 3D geometric render, faceted surfaces, abstract minimalism', tags: ['low-poly', '3d', 'geometric'] },
  { id: 'art-isometric', name: 'Isometric', category: 'artStyle', promptFragment: 'isometric 3D illustration, 30-degree angle, diorama-like scene', tags: ['isometric', '3d', 'diorama'] },
  { id: 'art-retro-pixel', name: 'Retro Pixel Art', category: 'artStyle', promptFragment: 'retro pixel art style, 16-bit game graphics, limited color palette', tags: ['pixel', 'retro', '16-bit'] },
  { id: 'art-nouveau', name: 'Art Nouveau', category: 'artStyle', promptFragment: 'Art Nouveau decorative style, flowing organic lines, Alphonse Mucha inspired', tags: ['art-nouveau', 'decorative', 'mucha'] },
  { id: 'art-impressionist', name: 'Impressionist', category: 'artStyle', promptFragment: 'Impressionist painting style, visible brushstrokes, light and color, Monet-inspired', tags: ['impressionist', 'painting', 'monet'] },
  { id: 'art-pencil', name: 'Pencil Sketch', category: 'artStyle', promptFragment: 'pencil sketch drawing, graphite on paper, hand-drawn hatching and shading', tags: ['pencil', 'sketch', 'hand-drawn'] },
  { id: 'art-charcoal', name: 'Charcoal Drawing', category: 'artStyle', promptFragment: 'charcoal drawing on textured paper, smudged edges, dramatic chiaroscuro', tags: ['charcoal', 'dramatic', 'textured'] },
  { id: 'art-stained-glass', name: 'Stained Glass', category: 'artStyle', promptFragment: 'stained glass window style, bold outlines, jewel-toned translucent panels', tags: ['stained-glass', 'jewel', 'medieval'] },
];

const COMPOSITION_PRESETS: CinematicPreset[] = [
  { id: 'comp-rule-of-thirds', name: 'Rule of Thirds', category: 'composition', promptFragment: 'composed using rule of thirds', tags: ['thirds', 'classic', 'balanced'] },
  { id: 'comp-center', name: 'Center Frame', category: 'composition', promptFragment: 'centered symmetrical composition', tags: ['center', 'symmetry', 'focus'] },
  { id: 'comp-golden-ratio', name: 'Golden Ratio', category: 'composition', promptFragment: 'golden ratio spiral composition', tags: ['golden', 'fibonacci', 'harmonious'] },
  { id: 'comp-leading-lines', name: 'Leading Lines', category: 'composition', promptFragment: 'composition with strong leading lines drawing the eye', tags: ['lines', 'depth', 'perspective'] },
  { id: 'comp-framing', name: 'Natural Framing', category: 'composition', promptFragment: 'natural frame-within-frame composition', tags: ['frame', 'layered', 'depth'] },
  { id: 'comp-negative-space', name: 'Negative Space', category: 'composition', promptFragment: 'minimal composition with large negative space', tags: ['minimal', 'space', 'isolation'] },
  { id: 'comp-diagonal', name: 'Diagonal Dynamic', category: 'composition', promptFragment: 'dynamic diagonal composition with energy and movement', tags: ['diagonal', 'dynamic', 'movement'] },
  { id: 'comp-fill-frame', name: 'Fill the Frame', category: 'composition', promptFragment: 'tightly cropped filling the entire frame', tags: ['tight', 'crop', 'impact'] },
  { id: 'comp-symmetrical', name: 'Symmetrical', category: 'composition', promptFragment: 'perfect bilateral symmetry, mirror-image composition', tags: ['symmetry', 'mirror', 'balanced'] },
  { id: 'comp-dutch-angle', name: 'Dutch Angle', category: 'composition', promptFragment: 'Dutch angle tilted composition, dynamic tension and unease', tags: ['tilted', 'dynamic', 'tension'] },
  { id: 'comp-birds-eye', name: "Bird's Eye Composition", category: 'composition', promptFragment: "bird's eye view composition, looking straight down from above", tags: ['overhead', 'birds-eye', 'aerial'] },
  { id: 'comp-worms-eye', name: "Worm's Eye Composition", category: 'composition', promptFragment: "worm's eye view composition, looking straight up from ground level", tags: ['low', 'ground', 'upward'] },
  { id: 'comp-triangular', name: 'Triangular', category: 'composition', promptFragment: 'triangular composition, three key elements forming a triangle', tags: ['triangle', 'three-point', 'stable'] },
  { id: 'comp-s-curve', name: 'S-Curve', category: 'composition', promptFragment: 'S-curve composition, flowing sinuous line guiding the eye through frame', tags: ['s-curve', 'flowing', 'natural'] },
  { id: 'comp-panoramic', name: 'Panoramic', category: 'composition', promptFragment: 'panoramic wide composition, ultra-wide landscape format', tags: ['panoramic', 'wide', 'landscape'] },
  { id: 'comp-radial', name: 'Radial', category: 'composition', promptFragment: 'radial composition, elements radiating outward from center', tags: ['radial', 'radiating', 'center'] },
  { id: 'comp-layered', name: 'Layered Depth', category: 'composition', promptFragment: 'layered depth composition with distinct foreground midground background planes', tags: ['layered', 'depth', 'planes'] },
];

// ─── Preset Lookups ───────────────────────────────────────────────

const ALL_PRESETS: CinematicPreset[] = [
  ...SHOT_TYPE_PRESETS,
  ...CAMERA_PRESETS,
  ...FOCAL_LENGTH_PRESETS,
  ...LENS_TYPE_PRESETS,
  ...LIGHTING_PRESETS,
  ...FILM_STOCK_PRESETS,
  ...PHOTOGRAPHER_STYLE_PRESETS,
  ...MOVIE_LOOK_PRESETS,
  ...FILTER_PRESETS,
  ...ART_STYLE_PRESETS,
  ...COMPOSITION_PRESETS,
];

const PRESET_BY_ID = new Map<string, CinematicPreset>(
  ALL_PRESETS.map((p) => [p.id, p]),
);

const PRESETS_BY_CATEGORY = new Map<PresetCategory, CinematicPreset[]>();
for (const preset of ALL_PRESETS) {
  const list = PRESETS_BY_CATEGORY.get(preset.category) ?? [];
  list.push(preset);
  PRESETS_BY_CATEGORY.set(preset.category, list);
}

/** Get every built-in preset. */
export function getAllPresets(): CinematicPreset[] {
  return ALL_PRESETS;
}

/** Search presets by name or tags (case-insensitive). */
export function searchPresets(query: string): CinematicPreset[] {
  const q = query.toLowerCase();
  return ALL_PRESETS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.promptFragment.toLowerCase().includes(q),
  );
}

/** Get all presets for a given category. */
export function getPresetsByCategory(category: PresetCategory): CinematicPreset[] {
  return PRESETS_BY_CATEGORY.get(category) ?? [];
}

/** Look up a single preset by its unique ID. */
export function getPresetById(id: string): CinematicPreset | undefined {
  return PRESET_BY_ID.get(id);
}

/** Human-readable label for a preset category. */
export function getCategoryLabel(category: PresetCategory): string {
  const labels: Record<PresetCategory, string> = {
    shotType: 'Shot Type',
    camera: 'Camera Body',
    focalLength: 'Focal Length',
    lensType: 'Lens Type',
    lighting: 'Lighting Setup',
    filmStock: 'Film Stock',
    photographerStyle: 'Photographer Style',
    movieLook: 'Movie Look',
    filter: 'Filters',
    artStyle: 'Art Style',
    composition: 'Composition',
  };
  return labels[category];
}

// ─── Prompt Fragment Builders ────────────────────────────────────────

function shotTypeFragment(shotType: string): string {
  const map: Record<string, string> = {
    'extreme-close-up': 'extreme close-up shot',
    'close-up': 'close-up shot',
    'medium-close-up': 'medium close-up shot',
    'medium': 'medium shot',
    'medium-wide': 'medium wide shot',
    'wide': 'wide shot',
    'extreme-wide': 'extreme wide establishing shot',
    'full-body': 'full body shot',
    'over-shoulder': 'over-the-shoulder shot',
    'dutch-angle': 'Dutch angle shot',
    'birds-eye': "bird's eye view shot",
    'worms-eye': "worm's eye view shot",
    'pov': 'first-person POV shot',
    'two-shot': 'two-shot framing',
    'insert': 'insert detail shot',
  };
  return map[shotType] ?? `${shotType} shot`;
}

function cameraFragment(camera: string): string {
  const map: Record<string, string> = {
    'static': 'locked-off static camera',
    'handheld': 'handheld camera with natural movement',
    'steadicam': 'smooth Steadicam tracking',
    'dolly': 'dolly tracking shot',
    'crane': 'crane sweeping shot',
    'drone': 'aerial drone shot',
    'pan': 'slow pan',
    'tilt': 'slow tilt',
    'zoom': 'slow push-in zoom',
    'whip-pan': 'whip pan motion blur',
    'rack-focus': 'rack focus pull',
    'slider': 'slider movement',
  };
  return map[camera] ?? `${camera} camera movement`;
}

function lightingFragment(lighting: string): string {
  const map: Record<string, string> = {
    'golden-hour': 'golden hour warm natural light',
    'blue-hour': 'blue hour twilight lighting',
    'high-key': 'high-key bright even lighting',
    'low-key': 'low-key dramatic shadows',
    'rembrandt': 'Rembrandt lighting with triangle shadow',
    'butterfly': 'butterfly/Paramount lighting',
    'split': 'split lighting half-shadow',
    'rim': 'rim/edge lighting with backlit glow',
    'neon': 'neon-lit cyberpunk lighting',
    'natural': 'natural ambient daylight',
    'studio': 'three-point studio lighting',
    'silhouette': 'silhouette backlighting',
    'chiaroscuro': 'chiaroscuro dramatic light and shadow',
    'overcast': 'soft overcast diffused lighting',
    'candlelight': 'warm candlelight ambiance',
    'moonlight': 'cool blue moonlight',
  };
  return map[lighting] ?? `${lighting} lighting`;
}

function focalLengthFragment(focalLength: string): string {
  return `shot at ${focalLength}`;
}

function lensTypeFragment(lensType: string): string {
  const map: Record<string, string> = {
    'prime': 'sharp prime lens',
    'anamorphic': 'anamorphic widescreen lens with horizontal flares',
    'tilt-shift': 'tilt-shift miniature effect lens',
    'macro': 'macro lens extreme detail',
    'fisheye': 'fisheye ultra-wide distortion',
    'telephoto': 'telephoto compressed depth',
    'vintage': 'vintage lens with character and softness',
    'cinema': 'cinema prime T1.5 shallow depth of field',
  };
  return map[lensType] ?? `${lensType} lens`;
}

function filmStockFragment(filmStock: string): string {
  const map: Record<string, string> = {
    'kodak-portra-400': 'Kodak Portra 400 warm skin tones',
    'kodak-ektar-100': 'Kodak Ektar 100 vivid saturated colors',
    'fuji-pro-400h': 'Fujifilm Pro 400H pastel cool tones',
    'ilford-hp5': 'Ilford HP5 Plus black and white grain',
    'kodak-tri-x': 'Kodak Tri-X 400 high contrast B&W',
    'cinestill-800t': 'CineStill 800T tungsten halation',
    'kodak-vision3-500t': 'Kodak Vision3 500T cinema film',
    'fuji-velvia-50': 'Fuji Velvia 50 hyper-saturated colors',
  };
  return map[filmStock] ?? `${filmStock} film stock look`;
}

function photographerFragment(photographer: string): string {
  return `in the style of ${photographer}`;
}

function movieLookFragment(movieLook: string): string {
  const map: Record<string, string> = {
    'blade-runner': 'Blade Runner 2049 neon noir dystopian color grade',
    'wes-anderson': 'Wes Anderson symmetrical pastel aesthetic',
    'christopher-nolan': 'Christopher Nolan IMAX epic realism',
    'david-fincher': 'David Fincher desaturated dark thriller grade',
    'terrence-malick': 'Terrence Malick ethereal golden hour naturalism',
    'denis-villeneuve': 'Denis Villeneuve vast desolate cinematic scale',
    'tarantino': 'Quentin Tarantino warm retro grindhouse palette',
    'kubrick': 'Stanley Kubrick symmetrical one-point perspective',
    'spielberg': 'Steven Spielberg warm nostalgic blockbuster lighting',
    'ridley-scott': 'Ridley Scott atmospheric epic production design',
    'wong-kar-wai': 'Wong Kar-wai saturated neon step-printed motion',
    'mad-max': 'Mad Max: Fury Road orange-teal desert post-apocalyptic',
    'matrix': 'The Matrix green-tinted digital reality',
    'dune': 'Dune 2021 vast desert warm desaturated epic',
  };
  return map[movieLook] ?? `${movieLook} cinematic color grade`;
}

function artStyleFragment(artStyle: string): string {
  const map: Record<string, string> = {
    'photorealistic': 'photorealistic',
    'hyperrealistic': 'hyperrealistic 8K detail',
    'anime': 'anime art style',
    'manga': 'manga illustration style',
    'comic': 'comic book illustration',
    'oil-painting': 'oil painting on canvas',
    'watercolor': 'delicate watercolor painting',
    'digital-art': 'polished digital art',
    'concept-art': 'professional concept art',
    'pixar-3d': 'Pixar 3D animated render',
    'cyberpunk': 'cyberpunk neon digital art',
    'fantasy': 'high fantasy illustration',
    'noir': 'film noir black and white',
    'pop-art': 'pop art bold colors',
    'art-nouveau': 'Art Nouveau decorative style',
    'ukiyo-e': 'ukiyo-e Japanese woodblock print',
    'low-poly': 'low-poly 3D render',
    'isometric': 'isometric 3D illustration',
    'vaporwave': 'vaporwave retro-futuristic aesthetic',
    'steampunk': 'steampunk Victorian mechanical aesthetic',
  };
  return map[artStyle] ?? `${artStyle} style`;
}

function filterFragment(filter: string): string {
  const map: Record<string, string> = {
    'grain': 'with subtle film grain',
    'bloom': 'with soft bloom/glow effect',
    'vignette': 'with cinematic vignette',
    'chromatic-aberration': 'with chromatic aberration fringing',
    'lens-flare': 'with anamorphic lens flare',
    'motion-blur': 'with motion blur',
    'depth-of-field': 'with shallow depth of field bokeh',
    'haze': 'with atmospheric haze',
    'rain': 'through rain-streaked glass',
    'fog': 'with volumetric fog',
    'dust': 'with floating dust particles',
    'light-leak': 'with warm film light leak',
  };
  return map[filter] ?? `with ${filter} effect`;
}

function compositionFragment(composition: string): string {
  const map: Record<string, string> = {
    'rule-of-thirds': 'composed on rule of thirds',
    'centered': 'perfectly centered symmetrical composition',
    'golden-ratio': 'golden ratio spiral composition',
    'leading-lines': 'with strong leading lines',
    'frame-within-frame': 'frame within a frame composition',
    'negative-space': 'with dramatic negative space',
    'diagonal': 'dynamic diagonal composition',
    'triangular': 'triangular composition',
    'fill-frame': 'subject fills the entire frame',
  };
  return map[composition] ?? `${composition} composition`;
}

// ─── Main Assembly Function ──────────────────────────────────────────

/**
 * Builds a fully assembled cinematic prompt from a user's subject text
 * and structured CinematicConfig preset selections.
 *
 * @param subjectPrompt - The user's core subject/scene description
 * @param presets - Structured cinematic configuration presets
 * @returns Fully assembled prompt string ready for generation
 */
export function buildPromptFromPresets(
  subjectPrompt: string,
  presets?: CinematicConfig
): string {
  if (!presets) {
    return subjectPrompt;
  }

  const fragments: string[] = [];

  // 1. Shot type comes first — it sets the framing context
  if (presets.shotType) {
    fragments.push(shotTypeFragment(presets.shotType));
  }

  // 2. Core subject
  fragments.push(subjectPrompt);

  // 3. Viewing direction
  if (presets.viewingDirection) {
    fragments.push(`viewed from the ${presets.viewingDirection}`);
  }

  // 4. Subject awareness
  if (presets.subjectUnawareOfCamera) {
    fragments.push('subject unaware of camera, candid natural moment');
  }

  // 5. Art style — sets the overall rendering approach
  if (presets.artStyle) {
    fragments.push(artStyleFragment(presets.artStyle));
  }

  // 6. Camera movement
  if (presets.camera) {
    fragments.push(cameraFragment(presets.camera));
  }

  // 7. Focal length
  if (presets.focalLength) {
    fragments.push(focalLengthFragment(presets.focalLength));
  }

  // 8. Lens type
  if (presets.lensType) {
    fragments.push(lensTypeFragment(presets.lensType));
  }

  // 9. Lighting
  if (presets.lighting) {
    fragments.push(lightingFragment(presets.lighting));
  }

  // 10. Atmosphere
  if (presets.atmosphere) {
    fragments.push(presets.atmosphere);
  }

  // 11. Film stock
  if (presets.filmStock) {
    fragments.push(filmStockFragment(presets.filmStock));
  }

  // 12. Photographer style
  if (presets.photographerStyle) {
    fragments.push(photographerFragment(presets.photographerStyle));
  }

  // 13. Movie look
  if (presets.movieLook) {
    fragments.push(movieLookFragment(presets.movieLook));
  }

  // 14. Composition
  if (presets.composition) {
    fragments.push(compositionFragment(presets.composition));
  }

  // 15. Filters (can stack multiple)
  if (presets.filters && presets.filters.length > 0) {
    for (const filter of presets.filters) {
      fragments.push(filterFragment(filter));
    }
  }

  return fragments.join(', ');
}

// ─── Scene Config Builder (Video Studio) ───────────────────────────

/**
 * Builds a fully assembled prompt from a SceneGenerationConfig.
 * Used by Video Studio where each scene has script text + cinematic controls.
 */
export function buildPromptFromConfig(config: SceneGenerationConfig): string {
  const parts: string[] = [];
  if (config.scriptText) {
    parts.push(config.scriptText);
  }
  if (config.visualDescription) {
    parts.push(config.visualDescription);
  }
  const basePrompt = parts.join('. ');
  return buildPromptFromPresets(basePrompt, config);
}

// ─── Genre Presets ──────────────────────────────────────────────────

const GENRE_PRESETS: GenrePreset[] = [
  {
    id: 'genre-post-apocalyptic',
    name: 'Post-Apocalyptic Film',
    description: 'Desaturated, gritty, bleak wasteland aesthetic',
    config: {
      camera: 'cam-arri-alexa',
      focalLength: 'fl-24mm',
      filmStock: 'film-cinestill-800t',
      lighting: 'light-low-key',
      filters: ['filter-desaturated', 'filter-grain'],
      artStyle: 'art-photorealistic',
      atmosphere: 'desolate, post-apocalyptic, bleak',
    },
    tags: ['post-apocalyptic', 'gritty', 'wasteland', 'survival'],
  },
  {
    id: 'genre-war-film',
    name: 'War Film',
    description: 'Handheld intensity, desaturated Saving Private Ryan palette',
    config: {
      camera: 'cam-arri-alexa',
      focalLength: 'fl-35mm',
      filmStock: 'film-cinestill-800t',
      lighting: 'light-overcast',
      movieLook: 'movie-saving-private-ryan',
      filters: ['filter-desaturated', 'filter-grain'],
      artStyle: 'art-photorealistic',
      atmosphere: 'intense, chaotic, visceral',
    },
    tags: ['war', 'military', 'intense', 'historical'],
  },
  {
    id: 'genre-romantic-comedy',
    name: 'Romantic Comedy',
    description: 'Warm, soft, golden tones with flattering portrait lighting',
    config: {
      camera: 'cam-canon-5d',
      focalLength: 'fl-85mm',
      filmStock: 'film-kodak-portra-400',
      lighting: 'light-golden-hour',
      lensType: 'lens-soft-focus',
      filters: ['filter-bloom', 'filter-light-leak'],
      artStyle: 'art-photorealistic',
      atmosphere: 'warm, romantic, lighthearted',
    },
    tags: ['romance', 'comedy', 'warm', 'love'],
  },
  {
    id: 'genre-found-footage-phone',
    name: 'Found Footage (Cell Phone)',
    description: 'iPhone-quality, direct flash, raw UGC aesthetic',
    config: {
      camera: 'cam-iphone',
      focalLength: 'fl-24mm',
      lighting: 'light-hard-flash',
      filters: ['filter-grain'],
      artStyle: 'art-photorealistic',
      atmosphere: 'raw, unpolished, authentic',
    },
    tags: ['found-footage', 'phone', 'ugc', 'authentic'],
  },
  {
    id: 'genre-found-footage-vhs',
    name: 'Found Footage (VHS)',
    description: 'VHS tracking artifacts, CRT scanlines, lo-fi horror',
    config: {
      camera: 'cam-vhs',
      focalLength: 'fl-24mm',
      lighting: 'light-hard-flash',
      filters: ['filter-grain', 'filter-chromatic', 'filter-desaturated'],
      artStyle: 'art-photorealistic',
      atmosphere: 'lo-fi, eerie, degraded',
    },
    tags: ['found-footage', 'vhs', 'horror', 'retro'],
  },
  {
    id: 'genre-dark-fantasy',
    name: 'Dark Fantasy',
    description: 'Rich shadows, CineStill glow, Pan\'s Labyrinth atmosphere',
    config: {
      camera: 'cam-red-v-raptor',
      lensType: 'lens-anamorphic',
      filmStock: 'film-cinestill-800t',
      lighting: 'light-low-key',
      movieLook: 'movie-pans-labyrinth',
      artStyle: 'art-fantasy',
      atmosphere: 'dark, mythical, enchanted',
    },
    tags: ['dark-fantasy', 'gothic', 'mythical', 'enchanted'],
  },
  {
    id: 'genre-80s-teen-drama',
    name: '80s Teen Drama',
    description: 'Kodak Gold warmth, golden hour, light leaks, nostalgic',
    config: {
      camera: 'cam-35mm-film',
      filmStock: 'film-kodak-gold-200',
      lighting: 'light-golden-hour',
      filters: ['filter-light-leak', 'filter-grain'],
      artStyle: 'art-photorealistic',
      atmosphere: 'nostalgic, youthful, carefree',
    },
    tags: ['80s', 'teen', 'nostalgia', 'coming-of-age'],
  },
  {
    id: 'genre-70s-crime-drama',
    name: '70s Gritty Crime Drama',
    description: 'Tri-X grain, hard lighting, Taxi Driver darkness',
    config: {
      camera: 'cam-16mm-film',
      filmStock: 'film-tri-x',
      lighting: 'light-hard-flash',
      movieLook: 'movie-taxi-driver',
      filters: ['filter-grain', 'filter-high-contrast'],
      artStyle: 'art-photorealistic',
      atmosphere: 'gritty, dangerous, paranoid',
    },
    tags: ['70s', 'crime', 'gritty', 'noir'],
  },
  {
    id: 'genre-60s-new-wave',
    name: '60s New Wave Romance',
    description: 'Ilford HP5 black and white, French New Wave style',
    config: {
      camera: 'cam-35mm-film',
      filmStock: 'film-ilford-hp5',
      lighting: 'light-natural-window',
      artStyle: 'art-noir',
      atmosphere: 'poetic, melancholic, existential',
    },
    tags: ['60s', 'new-wave', 'french', 'art-house'],
  },
  {
    id: 'genre-youtube-documentary',
    name: 'YouTube Documentary',
    description: 'Clean, well-lit, professional yet accessible',
    config: {
      camera: 'cam-sony-a7iii',
      focalLength: 'fl-24mm',
      lighting: 'light-natural-window',
      artStyle: 'art-photorealistic',
      aspectRatio: '16:9',
      atmosphere: 'clean, informative, professional',
    },
    tags: ['youtube', 'documentary', 'educational', 'clean'],
  },
  {
    id: 'genre-hollywood-blockbuster',
    name: 'Hollywood Blockbuster',
    description: 'ARRI + anamorphic + Kodak Vision3 + three-point + bloom',
    config: {
      camera: 'cam-arri-alexa',
      lensType: 'lens-anamorphic',
      filmStock: 'film-kodak-vision3-500t',
      lighting: 'light-studio-three',
      filters: ['filter-bloom'],
      artStyle: 'art-photorealistic',
      atmosphere: 'epic, grand, spectacular',
    },
    tags: ['hollywood', 'blockbuster', 'epic', 'cinematic'],
  },
  {
    id: 'genre-spaghetti-western',
    name: 'Spaghetti Western',
    description: 'Anamorphic, Kodachrome, harsh sunlight, Leone framing',
    config: {
      camera: 'cam-35mm-film',
      lensType: 'lens-anamorphic',
      filmStock: 'film-kodachrome',
      lighting: 'light-hard-flash',
      filters: ['filter-grain', 'filter-high-contrast'],
      artStyle: 'art-photorealistic',
      atmosphere: 'hot, dusty, tense',
    },
    tags: ['western', 'spaghetti', 'leone', 'desert'],
  },
  {
    id: 'genre-60s-historical-epic',
    name: '60s Historical Epic',
    description: 'Panavision + anamorphic + Kodachrome + golden hour',
    config: {
      camera: 'cam-panavision',
      lensType: 'lens-anamorphic',
      filmStock: 'film-kodachrome',
      lighting: 'light-golden-hour',
      movieLook: 'movie-ben-hur',
      artStyle: 'art-photorealistic',
      atmosphere: 'grand, sweeping, majestic',
    },
    tags: ['historical', 'epic', '60s', 'grand'],
  },
  {
    id: 'genre-technicolor',
    name: 'Technicolor Movie',
    description: 'Saturated, vivid primary colors, golden age Hollywood',
    config: {
      camera: 'cam-35mm-film',
      filmStock: 'film-velvia',
      lighting: 'light-studio-three',
      artStyle: 'art-photorealistic',
      atmosphere: 'vivid, saturated, theatrical',
    },
    tags: ['technicolor', 'classic', 'vivid', 'golden-age'],
  },
  {
    id: 'genre-modern-crime-drama',
    name: 'Modern Crime Drama',
    description: 'Sony Venice + CineStill 800T + Se7en look + desaturated',
    config: {
      camera: 'cam-sony-venice',
      focalLength: 'fl-50mm',
      filmStock: 'film-cinestill-800t',
      lighting: 'light-low-key',
      movieLook: 'movie-se7en',
      filters: ['filter-desaturated'],
      artStyle: 'art-photorealistic',
      atmosphere: 'dark, suspenseful, atmospheric',
    },
    tags: ['crime', 'thriller', 'modern', 'dark'],
  },
  {
    id: 'genre-modern-sci-fi',
    name: 'Modern Sci-Fi Film',
    description: 'RED + anamorphic + Blade Runner 2049 look + volumetric',
    config: {
      camera: 'cam-red-v-raptor',
      lensType: 'lens-anamorphic',
      lighting: 'light-volumetric',
      movieLook: 'movie-blade-runner',
      artStyle: 'art-photorealistic',
      atmosphere: 'vast, futuristic, atmospheric',
    },
    tags: ['sci-fi', 'futuristic', 'cinematic', 'epic'],
  },
  {
    id: 'genre-luxury-video',
    name: 'Luxury Video',
    description: 'Sony Venice + 85mm + Portra 160 + softbox + dreamy',
    config: {
      camera: 'cam-sony-venice',
      focalLength: 'fl-85mm',
      filmStock: 'film-kodak-portra-400',
      lighting: 'light-studio-three',
      filters: ['filter-bloom', 'filter-haze'],
      artStyle: 'art-photorealistic',
      atmosphere: 'luxurious, elegant, refined',
    },
    tags: ['luxury', 'fashion', 'elegant', 'premium'],
  },
];

/** Get all genre presets — curated full-config combinations. */
export function getGenrePresets(): GenrePreset[] {
  return GENRE_PRESETS;
}

// ─── Recommended Presets (AI Agent Helper) ─────────────────────────

/**
 * Returns recommended CinematicConfig based on content context.
 * Used by Jasper and the AI agent to auto-select sensible defaults.
 */
export function getRecommendedPresets(context: {
  videoType?: string;
  platform?: string;
  audience?: string;
}): CinematicConfig {
  const config: CinematicConfig = {};

  // Video type mappings
  switch (context.videoType) {
    case 'testimonial':
      config.lighting = 'light-rembrandt';
      config.focalLength = 'fl-85mm';
      config.filmStock = 'film-kodak-portra-400';
      config.shotType = 'shot-medium-close';
      config.composition = 'comp-rule-of-thirds';
      break;
    case 'product_demo':
      config.lighting = 'light-studio-three';
      config.shotType = 'shot-close-up';
      config.lensType = 'lens-macro';
      config.artStyle = 'art-photorealistic';
      break;
    case 'social_reel':
      config.aspectRatio = '9:16';
      config.lighting = 'light-neon';
      config.shotType = 'shot-medium';
      config.filters = ['filter-bloom'];
      break;
    case 'corporate':
      config.lighting = 'light-studio-three';
      config.camera = 'cam-sony-venice';
      config.artStyle = 'art-photorealistic';
      config.filmStock = 'film-kodak-portra-400';
      config.focalLength = 'fl-50mm';
      break;
    case 'documentary':
      config.camera = 'cam-sony-a7iii';
      config.focalLength = 'fl-24mm';
      config.lighting = 'light-natural-window';
      config.artStyle = 'art-photorealistic';
      break;
    case 'music_video':
      config.lensType = 'lens-anamorphic';
      config.lighting = 'light-neon';
      config.filters = ['filter-bloom', 'filter-chromatic'];
      break;
    case 'tutorial':
      config.lighting = 'light-studio-three';
      config.focalLength = 'fl-35mm';
      config.artStyle = 'art-photorealistic';
      config.aspectRatio = '16:9';
      break;
    default:
      break;
  }

  // Platform mappings
  switch (context.platform) {
    case 'youtube':
      config.aspectRatio = config.aspectRatio ?? '16:9';
      break;
    case 'instagram':
    case 'tiktok':
      config.aspectRatio = config.aspectRatio ?? '9:16';
      break;
    case 'linkedin':
      config.aspectRatio = config.aspectRatio ?? '16:9';
      config.artStyle = config.artStyle ?? 'art-photorealistic';
      break;
    case 'twitter':
      config.aspectRatio = config.aspectRatio ?? '16:9';
      break;
    default:
      break;
  }

  // Audience mappings
  switch (context.audience) {
    case 'corporate':
    case 'enterprise':
      config.artStyle = config.artStyle ?? 'art-photorealistic';
      config.lighting = config.lighting ?? 'light-studio-three';
      break;
    case 'youth':
    case 'gen-z':
      config.filters = [...(config.filters ?? []), 'filter-grain'];
      break;
    case 'luxury':
      config.filmStock = config.filmStock ?? 'film-kodak-portra-400';
      config.filters = [...(config.filters ?? []), 'filter-bloom'];
      break;
    default:
      break;
  }

  return config;
}
