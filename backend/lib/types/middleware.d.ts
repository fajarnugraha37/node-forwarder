export type Next = () => void | Promise<void>;

export type Middleware<T> = (context: T, next: Next) => Promise<void> | void;