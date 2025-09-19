// lib/storage.ts
import fs from 'fs';
import path from 'path';

interface StorageData {
  [key: string]: any;
}

class PersistentStorage {
  private data: StorageData = {};
  private filePath: string;

  constructor() {
    this.filePath = path.join(process.cwd(), 'temp', 'storage_cache.json');
    this.ensureDirectoryExists();
    this.loadFromFile();
  }

  private ensureDirectoryExists() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadFromFile() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(content);
        console.log('[STORAGE] Dados carregados do cache:', Object.keys(this.data));
      }
    } catch (error) {
      console.warn('[STORAGE] Erro ao carregar cache:', error);
      this.data = {};
    }
  }

  private saveToFile() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
      console.log('[STORAGE] Dados salvos no cache:', Object.keys(this.data));
    } catch (error) {
      console.warn('[STORAGE] Erro ao salvar cache:', error);
    }
  }

  get(key: string) {
    return this.data[key];
  }

  set(key: string, value: any) {
    this.data[key] = value;
    this.saveToFile();
    console.log(`[STORAGE] Definido ${key}:`, typeof value === 'object' ? JSON.stringify(value).substring(0, 100) + '...' : value);
  }

  delete(key: string) {
    delete this.data[key];
    this.saveToFile();
  }

  keys() {
    return Object.keys(this.data);
  }

  clear() {
    this.data = {};
    this.saveToFile();
  }
}

// Criar instância singleton
const persistentStorage = new PersistentStorage();

// Proxy para manter compatibilidade com sintaxe de array
export const storage = new Proxy(persistentStorage, {
  get(target, prop: string | symbol) {
    if (typeof prop === 'string') {
      // Se for um método da classe, retornar o método
      if (typeof (target as any)[prop] === 'function') {
        return (target as any)[prop].bind(target);
      }
      // Caso contrário, tratar como chave de dados
      return target.get(prop);
    }
    return (target as any)[prop];
  },
  set(target, prop: string | symbol, value) {
    if (typeof prop === 'string') {
      target.set(prop, value);
      return true;
    }
    return false;
  },
  deleteProperty(target, prop: string | symbol) {
    if (typeof prop === 'string') {
      target.delete(prop);
      return true;
    }
    return false;
  },
  ownKeys(target) {
    return target.keys();
  }
});
