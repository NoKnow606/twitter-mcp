import { createHash, randomBytes } from 'crypto';

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

export interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

export interface OAuth2State {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}

export class OAuth2Helper {
  private static readonly TWITTER_AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
  private static readonly TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
  
  /**
   * Generate OAuth2 state and PKCE parameters
   */
  static generateOAuth2State(): OAuth2State {
    const state = randomBytes(32).toString('hex');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    return {
      state,
      codeVerifier,
      codeChallenge
    };
  }

  /**
   * Generate authorization URL for OAuth2 flow
   */
  static generateAuthUrl(config: OAuth2Config, oauth2State: OAuth2State): string {
    const defaultScopes = ['tweet.read', 'tweet.write', 'users.read'];
    const scopes = config.scopes || defaultScopes;
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: scopes.join(' '),
      state: oauth2State.state,
      code_challenge: oauth2State.codeChallenge,
      code_challenge_method: 'S256'
    });

    return `${this.TWITTER_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  static async exchangeCodeForToken(
    config: OAuth2Config,
    code: string,
    codeVerifier: string
  ): Promise<OAuth2TokenResponse> {
    const response = await fetch(this.TWITTER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OAuth2 token exchange failed: ${error.error_description || error.error}`);
    }

    return await response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(
    config: OAuth2Config,
    refreshToken: string
  ): Promise<OAuth2TokenResponse> {
    const response = await fetch(this.TWITTER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OAuth2 token refresh failed: ${error.error_description || error.error}`);
    }

    return await response.json();
  }

  /**
   * Revoke access token
   */
  static async revokeToken(config: OAuth2Config, token: string): Promise<void> {
    const response = await fetch('https://api.twitter.com/2/oauth2/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        token: token,
        token_type_hint: 'access_token'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OAuth2 token revocation failed: ${error.error_description || error.error}`);
    }
  }
}