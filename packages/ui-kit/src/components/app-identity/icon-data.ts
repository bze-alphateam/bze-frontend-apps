// The BZE app icons, copied verbatim from the public branding repo
// bze-alphateam/Official-BZEdge-Graphics (master), beezee/apps/<app>/icon/svg/:
// `full` is the glyph path of icon.svg / icon-on-dark.svg, `small` the one of
// icon-small.svg / icon-small-on-dark.svg, and `from` / `to` the gradient stops
// both files use. Never edit the shapes here: change them with the generator in
// that repo's design tools, re-export, and copy the new values.
import type { BrandedAppKey } from '../../constants/app-identity';

export interface AppIconData {
    /** Gradient light end (top of the glyph, start of the ring). */
    from: string;
    /** Gradient dark end. */
    to: string;
    /** Glyph path of the full icon (48 px and up). */
    full: string;
    /** Glyph path of the small cut (16-32 px). */
    small: string;
}

export const APP_ICON_DATA: Record<BrandedAppKey, AppIconData> = {
    dex: {
        from: '#12C1E1',
        to: '#1694D2',
        full: 'M106 160 H326 V118 L406 184 L326 250 V208 H106 Z M406 304 H186 V262 L106 328 L186 394 V352 H406 Z',
        small: 'M106 160 H326 V118 L406 184 L326 250 V208 H106 Z M406 304 H186 V262 L106 328 L186 394 V352 H406 Z',
    },
    staking: {
        from: '#B57EDC',
        to: '#8E44AD',
        full: 'M 172 214 V 184 A 90 90 0 0 1 352 184 V 214 H 308 V 184 A 46 46 0 0 0 216 184 V 214 Z M 160 214 H 364 A 28 28 0 0 1 392 242 V 366 A 28 28 0 0 1 364 394 H 160 A 28 28 0 0 1 132 366 V 242 A 28 28 0 0 1 160 214 Z M 262 256 L 344 338 H 298 L 262 302 L 226 338 H 180 Z',
        small: 'M 172 214 V 184 A 90 90 0 0 1 352 184 V 214 H 308 V 184 A 46 46 0 0 0 216 184 V 214 Z M 160 214 H 364 A 28 28 0 0 1 392 242 V 366 A 28 28 0 0 1 364 394 H 160 A 28 28 0 0 1 132 366 V 242 A 28 28 0 0 1 160 214 Z M 262 256 L 344 338 H 298 L 262 302 L 226 338 H 180 Z',
    },
    burner: {
        from: '#FF8A1F',
        to: '#E85A00',
        full: 'M 264 86 C 302 150 382 200 382 290 C 382 360 328 406 258 406 C 188 406 134 360 134 290 C 134 246 152 212 178 186 C 184 216 196 238 214 252 C 216 180 234 130 264 86 Z M 258 274 C 282 300 302 320 302 344 C 302 365 284 378 258 378 C 232 378 214 365 214 344 C 214 322 236 298 258 274 Z',
        small: 'M 264 86 C 302 150 382 200 382 290 C 382 360 328 406 258 406 C 188 406 134 360 134 290 C 134 246 152 212 178 186 C 184 216 196 238 214 252 C 216 180 234 130 264 86 Z',
    },
    factory: {
        from: '#FFC933',
        to: '#E09B00',
        full: 'M 103 382 V 224 L 182 272 V 224 L 261 272 V 224 L 341 272 V 106 H 393 V 382 Z M 135 310 H 169 V 344 H 135 Z M 214 310 H 248 V 344 H 214 Z M 293 310 H 327 V 344 H 293 Z',
        small: 'M 103 382 V 224 L 182 272 V 224 L 261 272 V 224 L 341 272 V 106 H 393 V 382 Z',
    },
    communities: {
        from: '#3DD07A',
        to: '#1E9150',
        full: 'M 262 102.5 L 327.8 140.5 L 327.8 216.5 L 262 254.5 L 196.2 216.5 L 196.2 140.5 Z M 185.2 235.6 L 251 273.6 L 251 349.6 L 185.2 387.6 L 119.4 349.6 L 119.4 273.6 Z M 338.8 235.6 L 404.6 273.6 L 404.6 349.6 L 338.8 387.6 L 273 349.6 L 273 273.6 Z',
        small: 'M 262 102.5 L 327.8 140.5 L 327.8 216.5 L 262 254.5 L 196.2 216.5 L 196.2 140.5 Z M 185.2 235.6 L 251 273.6 L 251 349.6 L 185.2 387.6 L 119.4 349.6 L 119.4 273.6 Z M 338.8 235.6 L 404.6 273.6 L 404.6 349.6 L 338.8 387.6 L 273 349.6 L 273 273.6 Z',
    },
    explorer: {
        from: '#22C4E2',
        to: '#1694D2',
        full: 'M 337.5 299.1 A 120 120 0 1 0 303.6 333 L 383.5 412.9 L 417.4 379 Z M 165.4 232.9 A 72 72 0 1 0 309.4 232.9 A 72 72 0 1 0 165.4 232.9 Z M 237.4 222.5 L 203.1 202.7 L 237.4 182.9 L 271.7 202.7 Z M 246.4 238.1 L 280.7 218.3 L 280.7 257.9 L 246.4 277.7 Z M 228.4 238.1 L 228.4 277.7 L 194.1 257.9 L 194.1 218.3 Z',
        small: 'M 337.5 299.1 A 120 120 0 1 0 303.6 333 L 383.5 412.9 L 417.4 379 Z M 165.4 232.9 A 72 72 0 1 0 309.4 232.9 A 72 72 0 1 0 165.4 232.9 Z',
    },
};
