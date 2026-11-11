import { app, BrowserWindow, ipcMain, net, protocol, shell } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Site } from './site'

const here = dirname(fileURLToPath(import.meta.url))
const editorDir = resolve(here, '..')
const siteRoot = resolve(process.env.SITE_ROOT ?? join(editorDir, '..'))

protocol.registerSchemesAsPrivileged([
  { scheme: 'site-asset', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

const site = new Site(siteRoot, join(app.getPath('userData'), 'github-repos.json'), (path) => shell.trashItem(path))

function handle(channel: string, fn: (...args: any[]) => unknown) {
  ipcMain.handle(channel, (_event, ...args) => fn(...args))
}

handle('posts:list', () => site.listPosts())
handle('posts:read', (slug) => site.readPost(slug))
handle('posts:save', (post) => site.savePost(post))
handle('posts:create', () => site.createPost())
handle('posts:rename', (from, to) => site.renamePost(from, to))
handle('posts:delete', (slug) => site.deletePost(slug))
handle('media:import', (folder, name, bytes) => site.importImage(folder, name, bytes))
handle('media:list', () => site.listMedia())
handle('media:delete', (path) => site.deleteMedia(path))
handle('projects:load', () => site.loadProjects())
handle('projects:save', (config) => site.saveProjects(config))
handle('projects:refresh', () => site.refreshProjects())
handle('git:status', () => site.gitStatus())
handle('site:preview', async (path) => shell.openExternal(await site.previewUrl(path)))
handle('shell:open', (url: string) => {
  if (/^https?:\/\//.test(url)) return shell.openExternal(url)
})

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0B0E13',
    title: 'Site Editor',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      additionalArguments: [`--site-root=${siteRoot}`],
    },
  })

  // Links in the editor open in the real browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  const route = process.env.EDITOR_ROUTE ?? ''
  if (process.env.VITE_DEV_URL) await win.loadURL(`${process.env.VITE_DEV_URL}#${route}`)
  else await win.loadFile(join(editorDir, 'dist/index.html'), { hash: route })

  // UI checks: EDITOR_CHECK_SCRIPT runs a script in the window; EDITOR_SCREENSHOT=path.png then
  // captures the window once it settles, and quits.
  const script = process.env.EDITOR_CHECK_SCRIPT
  if (script) await win.webContents.executeJavaScript(await readFile(script, 'utf8'))
  const shot = process.env.EDITOR_SCREENSHOT
  if (shot) {
    setTimeout(async () => {
      const image = await win.webContents.capturePage()
      await writeFile(shot, image.toPNG())
      app.quit()
    }, Number(process.env.EDITOR_SCREENSHOT_DELAY ?? 2500))
  }
}

app.whenReady().then(() => {
  protocol.handle('site-asset', (request) => {
    const { pathname } = new URL(request.url)
    return net.fetch(pathToFileURL(site.publicFile(pathname)).href)
  })
  void createWindow()
})

app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => site.stopPreview())
