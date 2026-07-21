export function useApi() {
  const config = useRuntimeConfig()
  const baseURL = config.public?.apiBase as string | undefined

  function get<T>(url: string, params?: Record<string, string | number | boolean | undefined>) {
    return $fetch<T>(url, {
      baseURL,
      params,
      method: 'GET',
    })
  }

  function post<T>(
    url: string,
    body?: object | string | null,
    options: { keepalive?: boolean } = {},
  ) {
    return $fetch<T>(url, {
      baseURL,
      method: 'POST',
      body,
      keepalive: options.keepalive,
    })
  }

  return { get, post }
}
