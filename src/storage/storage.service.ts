import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { extname } from 'path';
import { v4 } from 'uuid';

@Injectable()
export class StorageService {
  private supabaseClient: SupabaseClient;

  private folderConfig: Record<string, { bucket: string; public: boolean }> = {
    avatars: { bucket: 'public-assets', public: true },
    portfolios: { bucket: 'public-assets', public: true },
    portfolio: { bucket: 'public-assets', public: true },
    deliverables: { bucket: 'private-files', public: false },
  };

  constructor(private readonly configService: ConfigService) {
    this.supabaseClient = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    );
  }

  private getConfig(folder: string) {
    const config = this.folderConfig[folder];

    if (!config) {
      throw new BadRequestException(`Invalid folder. Allowed: ${Object.keys(this.folderConfig).join(', ')}`);
    }

    return config;
  }

  async getSignedUploadUrl(params: { userId: string; fileName: string; folder: string; projectId?: string }) {
    const { userId, fileName, folder, projectId } = params;
    const config = this.getConfig(folder);
    const normalizedFolder = folder === 'portfolio' ? 'portfolios' : folder;

    if (normalizedFolder === 'deliverables' && !projectId) {
      throw new BadRequestException('projectId is required for deliverables folder.');
    }

    const fileExtension = extname(fileName);
    const generatedFileName = `${v4()}${fileExtension}`;
    const path =
      normalizedFolder === 'deliverables'
        ? `${normalizedFolder}/${projectId}/${userId}-${generatedFileName}`
        : `${normalizedFolder}/${userId}/${generatedFileName}`;

    const { data, error } = await this.supabaseClient.storage.from(config.bucket).createSignedUploadUrl(path);

    if (error) {
      throw new InternalServerErrorException(`SUPABASE_SIGNED_UPLOAD_ERROR: ${error.message}`);
    }

    return {
      signedUrl: data.signedUrl,
      token: data.token,
      path,
      bucket: config.bucket,
    };
  }

  async getSignedReadUrl(folder: string, path: string, expiresInSeconds = 300): Promise<string> {
    const config = this.getConfig(folder);

    if (config.public) {
      throw new BadRequestException('Folder does not require signed URL.');
    }

    const { data, error } = await this.supabaseClient.storage
      .from(config.bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      throw new InternalServerErrorException(`SUPABASE_SIGNED_URL_ERROR: ${error.message}`);
    }

    return data.signedUrl;
  }

  getPublicUrl(folder: string, path: string): string {
    const config = this.getConfig(folder);

    if (!config.public) {
      throw new BadRequestException('Folder requires signed URL.');
    }

    const { data } = this.supabaseClient.storage.from(config.bucket).getPublicUrl(path);
    return data.publicUrl;
  }
}
