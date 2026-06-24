import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { createProject } from '../lib/projectCreate';
import { closeSidebarOnMobile } from '../lib/device';

export type FolderModalState =
  | { kind: 'folder'; parentId?: string }
  | { kind: 'project' }
  | null;

export function useDocumentCreate() {
  const { workspace, createPage, loadPages, setSidebarOpen } = useStore();
  const navigate = useNavigate();
  const [folderModal, setFolderModal] = useState<FolderModalState>(null);

  const afterCreate = async (pageId: string) => {
    await loadPages();
    closeSidebarOnMobile(setSidebarOpen);
    navigate(`/page/${pageId}`);
  };

  const handleNewPage = async (parentId?: string) => {
    if (!workspace) return;
    if (parentId) {
      const page = await createPage({ type: 'page', title: 'Untitled', parentId });
      await afterCreate(page.id);
      return;
    }
    const project = await createProject(workspace.id, {
      projectTitle: 'Untitled',
      child: { type: 'page', title: 'Untitled' },
    });
    await afterCreate(project.id);
  };

  const handleNewDatabase = async (parentId?: string) => {
    if (!workspace) return;
    if (parentId) {
      const page = await createPage({ type: 'database', title: 'New Database', parentId });
      await afterCreate(page.id);
      return;
    }
    const project = await createProject(workspace.id, {
      projectTitle: 'New Database',
      child: { type: 'database', title: 'New Database' },
    });
    await afterCreate(project.id);
  };

  const handleNewFolderRequest = (parentId?: string) => {
    setFolderModal({ kind: 'folder', parentId });
  };

  const handleNewProjectRequest = () => {
    setFolderModal({ kind: 'project' });
  };

  const confirmNewFolder = async (name: string, icon?: string) => {
    if (!workspace || !folderModal) return;
    setFolderModal(null);

    if (folderModal.kind === 'project') {
      const project = await createProject(workspace.id, {
        projectTitle: name,
        projectIcon: icon || '🗂️',
      });
      await afterCreate(project.id);
      return;
    }

    const parentId = folderModal.parentId;
    const { page } = await api.createPage(workspace.id, {
      type: 'folder',
      title: name,
      parentId,
      icon: icon || '📁',
    });
    await afterCreate(page.id);
  };

  return {
    folderModal,
    setFolderModal,
    handleNewPage,
    handleNewDatabase,
    handleNewFolderRequest,
    handleNewProjectRequest,
    confirmNewFolder,
  };
}
