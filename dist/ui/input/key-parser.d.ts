export interface Key {
    name: string;
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
    sequence: string;
    code?: string;
}
export declare const ESC = "\u001B";
export type KeypressHandler = (key: Key) => void;
export declare function createDataListener(keypressHandler: KeypressHandler): (data: string) => void;
