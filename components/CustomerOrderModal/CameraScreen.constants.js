import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const DEFAULT_MAX_CAMERA_PHOTOS = 10;
export const THUMB_SIZE = 56;

export const BOX_WIDTH = SCREEN_WIDTH * 0.82;
export const BOX_HEIGHT = BOX_WIDTH * 0.78;
const GUIDE_HINT_HEIGHT = 24;
const GUIDE_HINT_GAP = 16;
const GUIDE_BLOCK_HEIGHT = BOX_HEIGHT + GUIDE_HINT_GAP + GUIDE_HINT_HEIGHT;
export const BOX_TOP = (SCREEN_HEIGHT - GUIDE_BLOCK_HEIGHT) / 2;
export const BOX_LEFT = (SCREEN_WIDTH - BOX_WIDTH) / 2;

export const CORNER_SIZE = 28;
export const CORNER_THICKNESS = 3;
export const SIDE_OVERLAY_WIDTH = (SCREEN_WIDTH - BOX_WIDTH) / 2;

export { SCREEN_WIDTH, SCREEN_HEIGHT };
