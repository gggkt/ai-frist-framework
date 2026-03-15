import 'reflect-metadata';
import { RestController, PostMapping, GetMapping, RequestBody, RequestParam, RequestHeader } from '@ai-partner-x/aiko-boot-starter-web';
import { Autowired } from '@ai-partner-x/aiko-boot';
import { AuthService } from '../service/auth.service.js';
import type { LoginDto, LoginResultDto, RefreshTokenDto } from '../dto/auth.dto.js';

@RestController({ path: '/auth' })
export class AuthController {
  @Autowired(AuthService)
  private authService!: AuthService;

  @PostMapping('/login')
  async login(@RequestBody() dto: LoginDto): Promise<LoginResultDto> {
    return this.authService.login(dto);
  }

  @PostMapping('/refresh')
  async refresh(@RequestBody() dto: RefreshTokenDto): Promise<{ accessToken: string }> {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @GetMapping('/info')
  async getUserInfo(@RequestParam('_uid') userId: string): Promise<LoginResultDto['userInfo']> {
    return this.authService.getUserInfo(Number(userId));
  }

  /**
   * 获取当前用户信息（基于 JWT token）
   *
   * 从 Authorization Header 获取 token
   *
   * @example
   * ```bash
   * # 使用 Header 传递 token（推荐方式）
   * curl -H "Authorization: Bearer <token>" http://localhost:3001/api/auth/current
   *
   * # 兼容方式：从请求体传递 token（旧方式）
   * curl -X POST http://localhost:3001/api/auth/current \
   *   -H "Content-Type: application/json" \
   *   -d '{"token": "<token>"}'
   * ```
   */
  @PostMapping('/current')
  async getCurrentUser(
    @RequestHeader('authorization', false) authorization: string
  ): Promise<LoginResultDto['userInfo']> {
    // 验证 token 是否存在
    if (!authorization) {
      throw new Error('Authorization header is required. Please provide: Bearer <token>');
    }

    // 支持 Authorization: Bearer <token> 格式
    let token = authorization;
    if (token.startsWith('Bearer ')) {
      token = token.substring(7); // 移除 "Bearer " 前缀
    }

    return this.authService.getCurrentUserByToken(token);
  }

}
