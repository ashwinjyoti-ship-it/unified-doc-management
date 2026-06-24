import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
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
    const page = await createPage({ type: 'page', title: 'Untitled', parentId });
    await afterCreate(page.id);
  };

  const handleNewDatabase = async (parentId?: string) => {
    const page = await createPage({ type: 'database', title: 'New Database', parentId });
    await afterCreate(page.id);
  };

  const handleNewFolderRequest = (parentId?: string) => {
    setFolderModal({ kind: 'folder', parentId });
  };

  const handleNewProjectRequest = () => {
    setFolderModal({ kind: 'project' });
  };

  const confirmNewFolder = async (name: string, icon?: string) => {
    if (!workspace || !folderModal) return;
    const parentId = folderModal.kind === 'folder' ? folderModal.parentId : undefined;
    setFolderModal(null);
    const { page } = await api.createPage(workspace.id, {
      type: 'folder',
      title: name,
      parentId,
      icon: icon || (folderModal.kind === 'project' ? '🗂️' : '📁'),
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
