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

  function post<T>(url: string, body?: object | string | null) {
    return $fetch<T>(url, {
      baseURL,
      method: 'POST',
      body,
    })
  }

  return { get, post }
}
