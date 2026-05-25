import { Test, TestingModule } from '@nestjs/testing';
import { IngestionService } from './ingestion.service';

describe('IngestionService', () => {
  let service: IngestionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IngestionService],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('stripHtml', () => {
    it('should remove HTML tags', () => {
      const html = '<p>Hello <b>World</b>!</p>';
      expect(service.stripHtml(html)).toBe('Hello World!');
    });
  });

  describe('chunkText', () => {
    it('should split text into chunks based on word count and sentences', () => {
      const text = 'This is a test sentence. This is another test sentence. '.repeat(50);
      const chunks = service.chunkText(text, 250);
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toMatch(/test sentence\.$/);
      expect(chunks[0].estimatedMinutes).toBeGreaterThan(0);
    });

    it('should respect sentence boundaries', () => {
      const text = 'Sentence one. Sentence two. Sentence three. Sentence four.';
      // Use very small limits for testing
      const chunks = service.chunkText(text, 250);
      expect(chunks[0].content).toContain('Sentence one.');
      expect(chunks[0].content).toMatch(/\.$/);
    });
  });
});
