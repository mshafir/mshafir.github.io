import { contextBridge, ipcRenderer } from 'electron'
import type { SiteApi } from '../src/shared/api'

const call =
  (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args)

const root = process.argv.find((arg) => arg.startsWith('--site-root='))?.slice('--site-root='.length) ?? ''

const api: SiteApi = {
  root,
  listPosts: call('posts:list'),
  readPost: call('posts:read'),
  savePost: call('posts:save'),
  createPost: call('posts:create'),
  renamePost: call('posts:rename'),
  deletePost: call('posts:delete'),
  importImage: call('media:import'),
  listMedia: call('media:list'),
  deleteMedia: call('media:delete'),
  loadProjects: call('projects:load'),
  saveProjects: call('projects:save'),
  refreshProjects: call('projects:refresh'),
  gitStatus: call('git:status'),
  previewSite: call('site:preview'),
  openExternal: call('shell:open'),
} as SiteApi

contextBridge.exposeInMainWorld('site', api)
