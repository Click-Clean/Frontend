import axios, { AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { Cookies } from 'react-cookie';
import { getAccessToken } from './auth';

export const client = (() => {
  return axios.create({
    headers: {
      Accept: 'application/json, text/plain, */*'
    },
    withCredentials: true
  });
}

)();

const cookie = new Cookies();

/** interceptors - request: access-token을 매 요청마다 헤더에 실어서 보냅니다 */
client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {

    const accessToken = cookie.get('access_token');

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    
    return config;
  },
  (error: AxiosError) => {

    return Promise.reject(error);
  }
);

// /** interceptors - response:  */
client.interceptors.response.use(
  (res: AxiosResponse) => {
    return res; // 정상 리턴
  },
  // 에러, 토큰 만료 or 그 외 에러
  async (err) => {

    const { config, response } = err;
    const originalConfig = config; 
  
    // 토큰 만료
    if (response?.status === 401 && !originalConfig._retry) {
      originalConfig._retry = true;

      try {
        // refreshToken 기반으로 accessToken,refreshToken 다시 요청하는 과정
        
        const refresh_token = cookie.get('refresh_token');
        if (refresh_token) {
          const status = await getAccessToken(refresh_token);

          if (status === 401) {
            // 재 로그인
            const link = `https://kauth.kakao.com/oauth/authorize?redirect_uri=${process.env.REACT_APP_REDIRECT_URL}&client_id=${process.env.REACT_APP_KAKAO_CLIENT_ID}&response_type=code`;
            window.location.href = link;
          }

        }

        const accessToken = cookie.get('access_token');
        if (accessToken) {
          originalConfig.headers.Authorization = `Bearer ${accessToken}`;
        }
  
        return await client(originalConfig); // 재요청, config인 Request는 바뀐 것이 없으므로 그대로 사용.
      } 
      catch (error: unknown) {
        // 토큰 요청 실패, 다시 로그인 해야함. 
        // 재 로그인
        const link = `https://kauth.kakao.com/oauth/authorize?redirect_uri=${process.env.REACT_APP_REDIRECT_URL}&client_id=${process.env.REACT_APP_KAKAO_CLIENT_ID}&response_type=code`;
        window.location.href = link;
  
        return Promise.reject(error);
      }
    }
  
    // 그 외 에러
    if (response?.status === 403 && err.response.data) {
      return Promise.reject(err.response.data);
    }
  
    return Promise.reject(err);
  }
);