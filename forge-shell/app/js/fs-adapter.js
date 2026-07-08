/**
 * fs-adapter.js
 *
 * Dual-mode file system adapter for Forge Shell.
 * Provides unified API that works in both browser (File System Access API)
 * and desktop (Tauri) modes.
 *
 * Runtime detection determines which backend to use:
 * - Browser: File System Access API with FileSystemDirectoryHandle
 * - Desktop: Tauri's native file operations via Rust backend
 */

(function(window) {
  'use strict';

  // Runtime environment detection
  const isTauri = typeof window.__TAURI__ !== 'undefined';
  const isBrowser = !isTauri && 'showDirectoryPicker' in window;
  // Neither Tauri nor the File System Access API is available (e.g. cmux's
  // embedded webview) — fall back to the local HTTP API served alongside
  // this page by forge-shell/server.js.
  const isServer = !isTauri && !isBrowser;

  console.log(`[ForgeFS] Runtime mode: ${isTauri ? 'Desktop (Tauri)' : isBrowser ? 'Browser (File System Access API)' : 'Server (local HTTP API)'}`);

  // Debug: Log available Tauri APIs
  if (isTauri) {
    console.log('[ForgeFS] Tauri APIs available:', Object.keys(window.__TAURI__ || {}));
    console.log('[ForgeFS] Dialog plugin check:', window.__TAURI_PLUGIN_DIALOG__);
  }

  /**
   * Unified File System API
   * Abstracts differences between browser and desktop modes
   */
  window.ForgeFS = {
    /**
     * Returns the current runtime mode
     * @returns {string} 'tauri', 'browser', or 'unsupported'
     */
    getMode() {
      if (isTauri) return 'tauri';
      if (isBrowser) return 'browser';
      return 'unsupported';
    },

    /**
     * Check if running in Tauri (desktop) mode
     * @returns {boolean}
     */
    isTauri() {
      return isTauri;
    },

    /**
     * Check if running in browser mode
     * @returns {boolean}
     */
    isBrowser() {
      return isBrowser;
    },

    /**
     * Check if running in server mode (local HTTP API fallback)
     * @returns {boolean}
     */
    isServer() {
      return isServer;
    },

    /**
     * True when `root` is an absolute path string rather than a
     * FileSystemDirectoryHandle (true for both Tauri and server mode).
     * @returns {boolean}
     */
    usesPathStrings() {
      return isTauri || isServer;
    },

    /**
     * Prompt user to select a directory
     * @returns {Promise<FileSystemDirectoryHandle|string>} Handle (browser) or path (Tauri)
     */
    async pickDirectory() {
      if (isTauri) {
        console.log('[ForgeFS] Opening directory picker (Tauri mode)');

        try {
          // Use Tauri's invoke API to call the dialog plugin
          const selected = await window.__TAURI__.core.invoke('plugin:dialog|open', {
            options: {
              directory: true,
              multiple: false,
              title: 'Select Project Folder'
            }
          });

          console.log('[ForgeFS] Dialog returned:', selected);

          if (!selected) {
            throw new Error('No directory selected');
          }

          return selected; // Returns path string
        } catch (error) {
          console.error('[ForgeFS] Directory picker error:', error);
          throw error;
        }
      } else if (isBrowser) {
        return await window.showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'documents'
        });
      } else {
        // Server mode: no native picker is available, so prompt for an
        // absolute path via the shared confirm dialog, offering recent
        // projects (from the server's config file) as autocomplete options.
        let recent = [];
        try {
          const config = await fetch('/api/config').then(r => r.json());
          recent = config.recentProjects || [];
        } catch (e) {
          console.warn('[ForgeFS] Could not load recent projects:', e);
        }

        const inputId = 'server-path-picker-input';
        const listId = 'server-path-picker-recent';
        const options = recent.map(p => `<option value="${p.replace(/"/g, '&quot;')}"></option>`).join('');
        const details = `
          <input id="${inputId}" type="text" list="${listId}" placeholder="/absolute/path/to/project"
                 style="width:100%;padding:8px;box-sizing:border-box;font-family:monospace;" autofocus />
          <datalist id="${listId}">${options}</datalist>
        `;

        const confirmed = await ForgeUtils.Confirm.show(
          'Select Project Folder',
          'Enter the absolute path to your Forge project directory:',
          details
        );

        if (!confirmed) {
          const abort = new Error('Directory selection cancelled');
          abort.name = 'AbortError';
          throw abort;
        }

        const input = document.getElementById(inputId);
        const selectedPath = input ? input.value.trim() : '';
        if (!selectedPath) {
          throw new Error('No path entered');
        }

        // Validate the path exists and is a directory before returning it.
        await this.readDir(selectedPath, '');
        return selectedPath;
      }
    },

    /**
     * Read a file's contents
     * @param {FileSystemDirectoryHandle|string} root - Directory handle or path
     * @param {string} relativePath - Path relative to root (e.g., "cards/epics/my-epic.md")
     * @returns {Promise<string>} File contents
     */
    async readFile(root, relativePath) {
      if (isTauri) {
        const fullPath = typeof root === 'string'
          ? `${root}/${relativePath}`
          : relativePath;

        try {
          const contents = await window.__TAURI__.core.invoke('read_file', {
            path: fullPath
          });
          return contents;
        } catch (error) {
          throw new Error(`Failed to read file ${relativePath}: ${error}`);
        }
      } else if (isBrowser) {
        // Navigate through directory structure
        const parts = relativePath.split('/').filter(p => p.length > 0);
        let currentHandle = root;

        for (let i = 0; i < parts.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
        }

        const fileName = parts[parts.length - 1];
        const fileHandle = await currentHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        return await file.text();
      } else {
        const fullPath = typeof root === 'string' ? `${root}/${relativePath}` : relativePath;
        const res = await fetch(`/api/fs/read?path=${encodeURIComponent(fullPath)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(`Failed to read file ${relativePath}: ${err.error}`);
        }
        return await res.text();
      }
    },

    /**
     * Write contents to a file
     * @param {FileSystemDirectoryHandle|string} root - Directory handle or path
     * @param {string} relativePath - Path relative to root
     * @param {string} content - File contents to write
     * @returns {Promise<void>}
     */
    async writeFile(root, relativePath, content) {
      if (isTauri) {
        const fullPath = typeof root === 'string'
          ? `${root}/${relativePath}`
          : relativePath;

        try {
          await window.__TAURI__.core.invoke('write_file', {
            path: fullPath,
            content: content
          });
        } catch (error) {
          throw new Error(`Failed to write file ${relativePath}: ${error}`);
        }
      } else if (isBrowser) {
        // Navigate through directory structure, creating if needed
        const parts = relativePath.split('/').filter(p => p.length > 0);
        let currentHandle = root;

        for (let i = 0; i < parts.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(parts[i], { create: true });
        }

        const fileName = parts[parts.length - 1];
        const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
      } else {
        const fullPath = typeof root === 'string' ? `${root}/${relativePath}` : relativePath;
        const res = await fetch('/api/fs/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullPath, content })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(`Failed to write file ${relativePath}: ${err.error}`);
        }
      }
    },

    /**
     * List entries in a directory
     * @param {FileSystemDirectoryHandle|string} root - Directory handle or path
     * @param {string} relativePath - Path relative to root (optional, defaults to "")
     * @returns {Promise<Array<{name: string, kind: 'file'|'directory'}>>}
     */
    async readDir(root, relativePath = '') {
      if (isTauri) {
        const fullPath = typeof root === 'string'
          ? (relativePath ? `${root}/${relativePath}` : root)
          : relativePath;

        try {
          const entries = await window.__TAURI__.core.invoke('read_dir', {
            path: fullPath
          });
          return entries; // Returns array of {name, kind}
        } catch (error) {
          throw new Error(`Failed to read directory ${relativePath}: ${error}`);
        }
      } else if (isBrowser) {
        // Navigate to target directory
        let currentHandle = root;
        if (relativePath) {
          const parts = relativePath.split('/').filter(p => p.length > 0);
          for (const part of parts) {
            currentHandle = await currentHandle.getDirectoryHandle(part);
          }
        }

        const entries = [];
        for await (const entry of currentHandle.values()) {
          entries.push({
            name: entry.name,
            kind: entry.kind
          });
        }
        return entries;
      } else {
        const fullPath = typeof root === 'string'
          ? (relativePath ? `${root}/${relativePath}` : root)
          : relativePath;
        const res = await fetch(`/api/fs/readdir?path=${encodeURIComponent(fullPath)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(`Failed to read directory ${relativePath}: ${err.error}`);
        }
        return await res.json();
      }
    },

    /**
     * Recursively list markdown files in a directory
     * @param {FileSystemDirectoryHandle|string} root - Directory handle or path
     * @param {string} subdir - Subdirectory within root (e.g., "cards/epics")
     * @returns {Promise<Array<{name: string, path: string, modified: number}>>}
     */
    async listMarkdownFiles(root, subdir) {
      if (isTauri) {
        const dirPath = typeof root === 'string' ? root : '';

        try {
          const files = await window.__TAURI__.core.invoke('list_md_files', {
            dirPath: dirPath,
            subdir: subdir
          });
          return files; // Returns array of {name, path, modified}
        } catch (error) {
          console.warn(`Failed to list markdown files in ${subdir}:`, error);
          return [];
        }
      } else if (isBrowser) {
        // Browser mode: navigate and recursively collect .md files
        const files = [];

        try {
          const parts = subdir.split('/').filter(p => p.length > 0);
          let currentHandle = root;

          for (const part of parts) {
            try {
              currentHandle = await currentHandle.getDirectoryHandle(part);
            } catch (e) {
              return []; // Directory doesn't exist
            }
          }

          await this._collectMarkdownFiles(currentHandle, '', files);
          return files;
        } catch (error) {
          console.warn(`Failed to list markdown files in ${subdir}:`, error);
          return [];
        }
      } else {
        const dirPath = typeof root === 'string' ? root : '';
        try {
          const res = await fetch(`/api/fs/list-md?path=${encodeURIComponent(dirPath)}&subdir=${encodeURIComponent(subdir)}`);
          if (!res.ok) return [];
          return await res.json();
        } catch (error) {
          console.warn(`Failed to list markdown files in ${subdir}:`, error);
          return [];
        }
      }
    },

    /**
     * Helper: recursively collect .md files (browser mode only)
     * @private
     */
    async _collectMarkdownFiles(dirHandle, relativePath, accumulator) {
      for await (const entry of dirHandle.values()) {
        const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
          const fileHandle = await dirHandle.getFileHandle(entry.name);
          const file = await fileHandle.getFile();

          accumulator.push({
            name: entry.name,
            path: entryPath,
            modified: file.lastModified
          });
        } else if (entry.kind === 'directory') {
          const subDirHandle = await dirHandle.getDirectoryHandle(entry.name);
          await this._collectMarkdownFiles(subDirHandle, entryPath, accumulator);
        }
      }
    },

    /**
     * Get file metadata (mainly for modification time)
     * @param {FileSystemDirectoryHandle|string} root - Directory handle or path
     * @param {string} relativePath - Path relative to root
     * @returns {Promise<{modified: number}>}
     */
    async getFileMeta(root, relativePath) {
      if (isTauri) {
        const fullPath = typeof root === 'string'
          ? `${root}/${relativePath}`
          : relativePath;

        try {
          const meta = await window.__TAURI__.core.invoke('get_file_meta', {
            path: fullPath
          });
          return meta; // Returns {modified: timestamp}
        } catch (error) {
          throw new Error(`Failed to get file metadata for ${relativePath}: ${error}`);
        }
      } else if (isBrowser) {
        // Navigate to file and get metadata
        const parts = relativePath.split('/').filter(p => p.length > 0);
        let currentHandle = root;

        for (let i = 0; i < parts.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
        }

        const fileName = parts[parts.length - 1];
        const fileHandle = await currentHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();

        return {
          modified: file.lastModified
        };
      } else {
        const fullPath = typeof root === 'string' ? `${root}/${relativePath}` : relativePath;
        const res = await fetch(`/api/fs/meta?path=${encodeURIComponent(fullPath)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(`Failed to get file metadata for ${relativePath}: ${err.error}`);
        }
        return await res.json();
      }
    },

    /**
     * Watch a directory for changes (Tauri only)
     * @param {string} path - Absolute path to watch
     * @param {function} callback - Called when files change: callback(changedPath)
     * @returns {Promise<function>} Cleanup function to stop watching
     */
    async watchDirectory(path, callback) {
      if (isTauri) {
        // Set up event listener for file changes
        const unlisten = await window.__TAURI__.event.listen('file-changed', (event) => {
          callback(event.payload.path);
        });

        // Start watching
        try {
          await window.__TAURI__.core.invoke('watch_directory', { path });
        } catch (error) {
          console.error('Failed to start directory watcher:', error);
          throw error;
        }

        // Return cleanup function
        return () => {
          unlisten();
          window.__TAURI__.core.invoke('unwatch_directory', { path }).catch(err => {
            console.warn('Failed to stop directory watcher:', err);
          });
        };
      } else {
        console.warn('File watching not supported outside Tauri mode');
        return () => {}; // No-op cleanup
      }
    },

    /**
     * Get the last used project path (Tauri only)
     * @returns {Promise<string|null>}
     */
    async getProjectPath() {
      if (isTauri) {
        try {
          return await window.__TAURI__.core.invoke('get_project_path');
        } catch (error) {
          return null;
        }
      }
      if (isServer) {
        try {
          const config = await fetch('/api/config').then(r => r.json());
          return config.currentProject || null;
        } catch (error) {
          return null;
        }
      }
      return null;
    },

    /**
     * Save the current project path (Tauri and server modes only)
     * @param {string} path - Project path to save
     * @returns {Promise<void>}
     */
    async setProjectPath(path) {
      if (isTauri) {
        try {
          await window.__TAURI__.core.invoke('set_project_path', { path });
        } catch (error) {
          console.error('Failed to save project path:', error);
        }
      } else if (isServer) {
        try {
          await fetch('/api/config/project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
          });
        } catch (error) {
          console.error('Failed to save project path:', error);
        }
      }
    },

    /**
     * Get recent projects list (Tauri and server modes only)
     * @returns {Promise<Array<string>>}
     */
    async getRecentProjects() {
      if (isTauri) {
        try {
          return await window.__TAURI__.core.invoke('get_recent_projects');
        } catch (error) {
          return [];
        }
      }
      if (isServer) {
        try {
          const config = await fetch('/api/config').then(r => r.json());
          return config.recentProjects || [];
        } catch (error) {
          return [];
        }
      }
      return [];
    },

    /**
     * Create a directory
     * @param {FileSystemDirectoryHandle|string} root - Directory handle or path
     * @param {string} relativePath - Path relative to root
     * @returns {Promise<void>}
     */
    async createDirectory(root, relativePath) {
      if (isTauri) {
        const fullPath = typeof root === 'string'
          ? `${root}/${relativePath}`
          : relativePath;

        try {
          await window.__TAURI__.core.invoke('create_directory', {
            path: fullPath
          });
        } catch (error) {
          throw new Error(`Failed to create directory ${relativePath}: ${error}`);
        }
      } else if (isBrowser) {
        // Navigate through directory structure, creating as needed
        const parts = relativePath.split('/').filter(p => p.length > 0);
        let currentHandle = root;

        for (const part of parts) {
          currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
        }
      } else {
        const fullPath = typeof root === 'string' ? `${root}/${relativePath}` : relativePath;
        const res = await fetch('/api/fs/mkdir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullPath })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(`Failed to create directory ${relativePath}: ${err.error}`);
        }
      }
    },

    /**
     * Delete a file
     * @param {FileSystemDirectoryHandle|string} root - Directory handle or path
     * @param {string} relativePath - Path relative to root
     * @returns {Promise<void>}
     */
    async deleteFile(root, relativePath) {
      if (isTauri) {
        const fullPath = typeof root === 'string'
          ? `${root}/${relativePath}`
          : relativePath;

        try {
          await window.__TAURI__.core.invoke('delete_file', {
            path: fullPath
          });
        } catch (error) {
          throw new Error(`Failed to delete file ${relativePath}: ${error}`);
        }
      } else if (isBrowser) {
        // Navigate to parent directory and remove the file
        const parts = relativePath.split('/').filter(p => p.length > 0);
        let currentHandle = root;

        // Navigate to parent directory
        for (let i = 0; i < parts.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
        }

        // Delete the file
        const fileName = parts[parts.length - 1];
        await currentHandle.removeEntry(fileName);
      } else {
        const fullPath = typeof root === 'string' ? `${root}/${relativePath}` : relativePath;
        const res = await fetch('/api/fs/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullPath })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(`Failed to delete file ${relativePath}: ${err.error}`);
        }
      }
    }
  };

  // Log successful initialization
  console.log('[ForgeFS] File system adapter initialized');

})(window);
