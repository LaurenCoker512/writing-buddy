export type RouteParams<T extends Record<string, string>> = {
  params: Promise<T>;
};
