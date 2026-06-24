import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { closeSidebarOnMobile } from '../lib/device';

export function useDocumentCreate() {
  const { workspace, createPage, loadPages, setSidebarOpen } = useStore();
  const navigate = useNavigate();
  const [folderModal, setFolderModal] = useState<{ parentId?: string } | null>(null);

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
    setFolderModal({ parentId });
  };

  const confirmNewFolder = async (name: string) => {
    if (!workspace) return;
    const parentId = folderModal?.parentId;
    setFolderModal(null);
    const { page } = await api.createPage(workspace.id, {
      type: 'folder',
      title: name,
      parentId,
      icon: '📁',
    });
    await afterCreate(page.id);
  };

  return {
    folderModal,
    setFolderModal,
    handleNewPage,
    handleNewDatabase,
    handleNewFolderRequest,
    confirmNewFolder,
  };
}
