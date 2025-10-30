/*
 * Auto-generated placeholder types for Fans Backend API.
 * Regenerate via scripts/openapi:gen once the backend server exposes /api-json.
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  id: number;
  uuid: string;
  email: string;
  nickname?: string;
  avatarUrl?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string; // semicolon-delimited errors
  error: string;
}

export type MultipartFile = Blob | Buffer | ArrayBuffer;

export interface ChunkUploadRequest {
  file: MultipartFile;
  chunkIndex: number;
  chunkTotal: number;
  fileUuid: string;
  chunkSize: number;
}

export interface ChunkUploadResponse {
  received: boolean;
  fileUuid: string;
  nextChunk?: number | null;
}

export interface UserProfileResponse {
  data: User;
}

export type LoginEndpoint = (payload: LoginRequest) => Promise<AuthResponse>;
