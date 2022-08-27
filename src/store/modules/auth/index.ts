import { unref } from 'vue';
import { defineStore } from 'pinia';
import { e } from 'unocss';
import { router } from '@/router';
import { fetchLogin, fetchUserInfo, fetchSendCode, fetchLoginTotp } from '@/service';
import { useRouterPush } from '@/composables';
import { clearAuthStorage, getToken, getUserInfo, setRefreshToken, setToken, setUserInfo } from '@/utils';
import { showErrorMsg } from '@/utils/service/msg';
import api from '~/mock/api';
import { useTabStore } from '../tab';
import { useRouteStore } from '../route';

interface AuthState {
  /** 用户信息 */
  userInfo: Auth.UserInfo;
  /** 用户token */
  token: string;
  /** 登录的加载状态 */
  loginLoading: boolean;

  showCodeInput: boolean;

  mfaId: string;

  mfaType: number;
}

export const useAuthStore = defineStore('auth-store', {
  state: (): AuthState => ({
    userInfo: getUserInfo(),
    token: getToken(),
    loginLoading: false,
    showCodeInput: false,
    mfaId: '',
    mfaType: 1
  }),
  getters: {
    getMfaId(state): string {
      return state.mfaId;
    },
    /** 是否登录 */
    isLogin(state) {
      return Boolean(state.token);
    }
  },
  actions: {
    setShowCodeInput(value) {
      this.showCodeInput = value;
    },
    /** 重置auth状态 */
    resetAuthStore() {
      const { toLogin } = useRouterPush(false);
      const { resetTabStore } = useTabStore();
      const { resetRouteStore } = useRouteStore();
      const route = unref(router.currentRoute);

      clearAuthStorage();
      this.$reset();

      resetTabStore();
      resetRouteStore();

      if (route.meta.requiresAuth) {
        toLogin();
      }
    },
    /**
     * 处理登录后成功或失败的逻辑
     * @param backendToken - 返回的token
     */
    async handleActionAfterLogin(backendToken: ApiAuth.Token) {
      const { toLoginRedirect } = useRouterPush(false);

      const loginSuccess = await this.loginByToken(backendToken);

      if (loginSuccess) {
        // 跳转登录后的地址
        toLoginRedirect();

        // 登录成功弹出欢迎提示
        window.$notification?.success({
          title: '登录成功!',
          content: `欢迎回来，${this.userInfo.userName}!`,
          duration: 3000
        });

        return;
      }

      // 不成功则重置状态
      this.resetAuthStore();
    },
    /**
     * 根据token进行登录
     * @param backendToken - 返回的token
     */
    async loginByToken(backendToken: ApiAuth.Token) {
      let successFlag = false;

      // 先把token存储到缓存中(后面接口的请求头需要token)
      const { token, refreshToken } = backendToken;
      setToken(token);
      setRefreshToken(refreshToken);

      // 获取用户信息
      const { data } = await fetchUserInfo();
      if (data) {
        // 成功后把用户信息存储到缓存中
        setUserInfo(data);

        // 更新状态
        this.userInfo = data;
        this.token = token;

        successFlag = true;
      }

      return successFlag;
    },
    /**
     * 登录
     * @param userName - 用户名
     * @param password - 密码
     */
    async login(userName: string, password: string) {
      this.loginLoading = true;
      const { data, error } = await fetchLogin(userName, password);
      if (data) {
        await this.handleActionAfterLogin(data);
      } else {
        // 短信认证方式
        if (error !== null && error.code === 401 && Object.prototype.hasOwnProperty.call(error, 'headers')) {
          if (error.headers['x-authenticate']) {
            if (error.headers['x-authenticate']?.includes('smsmfa')) {
              this.mfaType = 1;
              this.showCodeInput = true;
              const authHeader = error.headers['x-authenticate'];
              const splitValue = authHeader.split('=');
              this.mfaId = splitValue[1];
              await this.sendCode(splitValue[1]);
            } else if (error.headers['x-authenticate']?.includes('codemfa')) {
              this.mfaType = 2;
              this.showCodeInput = true;
              const authHeader = error.headers['x-authenticate'];
              const splitValue = authHeader.split('=');
              this.mfaId = splitValue[1];
            } else {
              showErrorMsg(error);
            }
          } else {
            showErrorMsg(error);
          }
        }
      }
      this.loginLoading = false;
    },

    async loginByCode(code: string, mfaId: string, mfaType: number) {
      const { data, error } = await fetchLoginTotp(code, mfaId, mfaType);
      if (data) {
        await this.handleActionAfterLogin(data);
      }
    },
    /**
     * 更换用户权限(切换账号)
     * @param userRole
     */
    async updateUserRole(userRole: Auth.RoleType) {
      const { resetRouteStore, initAuthRoute } = useRouteStore();

      const accounts: Record<Auth.RoleType, { userName: string; password: string }> = {
        super: {
          userName: 'Super',
          password: 'super123'
        },
        admin: {
          userName: 'Admin',
          password: 'admin123'
        },
        user: {
          userName: 'User01',
          password: 'user01123'
        }
      };
      const { userName, password } = accounts[userRole];
      const { data } = await fetchLogin(userName, password);
      if (data) {
        await this.loginByToken(data);
        resetRouteStore();
        initAuthRoute();
      }
    },

    async sendCode(mfaId: string) {
      const { data, error } = await fetchSendCode(mfaId);
      if (data) {
        await this.handleActionAfterLogin(data);
      } else {
        if (error) {
          if (error.data) {
            this.resetAuthStore();
          }
        }
      }
      this.loginLoading = false;
    }
  }
});
