import { useService } from '../service'
import { NavigationFailure } from 'vue-router'

export interface AuthServiceInterface {
  handleAuthError(route: any): any
  signinSilent(): Promise<unknown>
  logoutUser(): Promise<void | NavigationFailure>
  getRefreshToken(): Promise<string>
  showSessionExpiredModal(): void
  loginUserPopup(): Promise<unknown>
  reloadUserFromStorage(): Promise<void>
}

export const useAuthService = (): AuthServiceInterface => {
  return useService('$authService')
}
