import { Injectable } from '@nestjs/common';
import { EPub } from 'epub2';

@Injectable()
export class IngestionService {
  async parseEpub(buffer: Buffer): Promise<{ title: string; author: string; content: string }> {
    return new Promise((resolve, reject) => {
      const epub = new EPub(buffer as any);
      
      epub.on('end', async () => {
        let fullText = '';
        const title = epub.metadata.title || 'Unknown Title';
        const author = epub.metadata.creator || 'Unknown Author';

        try {
          // epub2 provides spine elements. We need to fetch text for each.
          for (const item of epub.spine.contents) {
            if (!item.id) continue;
            const text = await new Promise<string>((res, rej) => {
              epub.getChapter(item.id!, (err, data) => {
                if (err) rej(err);
                else res(data ?? '');
              });
            });
            fullText += this.stripHtml(text) + '\n\n';
          }
          resolve({ title, author, content: fullText });
        } catch (err) {
          reject(err);
        }
      });

      epub.on('error', (err) => reject(err));
      epub.parse();
    });
  }

  stripHtml(html: string): string {
    // Basic HTML stripping
    return html
      .replace(/<[^>]*>?/gm, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  chunkText(text: string, baseWPM: number): { content: string; estimatedMinutes: number }[] {
    const words = text.split(/\s+/);
    const targetWordCountMin = 500;
    const targetWordCountMax = 800;
    
    // We'll use a more sophisticated approach: split by sentences first
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
    const chunks: { content: string; estimatedMinutes: number }[] = [];
    
    let currentChunk = '';
    let currentWordCount = 0;

    for (const sentence of sentences) {
      const sentenceWords = sentence.split(/\s+/).length;
      
      if (currentWordCount + sentenceWords > targetWordCountMax && currentWordCount >= targetWordCountMin) {
        chunks.push({
          content: currentChunk.trim(),
          estimatedMinutes: Math.ceil(currentWordCount / baseWPM),
        });
        currentChunk = sentence;
        currentWordCount = sentenceWords;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentWordCount += sentenceWords;
      }
    }

    if (currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        estimatedMinutes: Math.ceil(currentWordCount / baseWPM),
      });
    }

    return chunks;
  }
}
