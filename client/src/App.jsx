import { useState, useEffect, useRef } from 'react';
import { 
  Send, Plus, Trash2, FolderPlus, Save, History as HistoryIcon, 
  Layers, Settings, Play, ChevronDown, ChevronRight, 
  X, RefreshCw, AlertCircle, FileText, Search, Copy, Check, Info
} from 'lucide-react';

const BACKEND_URL = 'http://localhost:5000';

function App() {
  // Authentication State
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(null);
  const [authPage, setAuthPage] = useState(localStorage.getItem('token') ? 'none' : 'login'); // 'login' | 'signup' | 'none'
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Tabs State
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);

  // Sidebar States
  const [sidebarTab, setSidebarTab] = useState('history'); // 'history' | 'collections'
  const [history, setHistory] = useState([]);
  const [collections, setCollections] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Backend Status
  const [backendOnline, setBackendOnline] = useState(false);

  // Modals
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaveAs, setIsSaveAs] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [saveReqName, setSaveReqName] = useState('');
  const [selectedColId, setSelectedColId] = useState('');
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');

  // UI States
  const [copiedTabId, setCopiedTabId] = useState(null);
  const [expandedCollections, setExpandedCollections] = useState({});

  // Initialize App with a default tab and check backend connection
  useEffect(() => {
    checkBackendStatus(token);
    
    // Add default tab
    const defaultTab = createNewTab();
    setTabs([defaultTab]);
    setActiveTabId(defaultTab.id);

    if (token) {
      verifyTokenAndLoadData(token);
    } else {
      setAuthPage('login');
    }

    // Check backend every 10 seconds
    const interval = setInterval(() => checkBackendStatus(token), 10000);
    return () => clearInterval(interval);
  }, []);

  const verifyTokenAndLoadData = async (activeToken) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setToken(activeToken);
        setAuthPage('none');
        setBackendOnline(true);
        fetchHistory(activeToken);
        fetchCollections(activeToken);
      } else {
        handleLogout();
      }
    } catch (e) {
      console.error('Failed to verify token on startup:', e);
      setBackendOnline(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setHistory([]);
    setCollections([]);
    setAuthPage('login');
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const email = authEmail.trim();
    const password = authPassword;
    const name = authName.trim();

    if (!email || !password) {
      setAuthError('Email and Password are required');
      setAuthLoading(false);
      return;
    }

    if (authPage === 'signup' && !name) {
      setAuthError('Name is required');
      setAuthLoading(false);
      return;
    }

    try {
      const endpoint = authPage === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const body = authPage === 'login' 
        ? { email, password }
        : { name, email, password };

      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed');
        setAuthLoading(false);
        return;
      }

      if (authPage === 'login') {
        const userToken = data.accessToken;
        localStorage.setItem('token', userToken);
        setToken(userToken);
        setUser(data.user);
        setAuthPage('none');
        setAuthEmail('');
        setAuthPassword('');
        setBackendOnline(true);
        fetchHistory(userToken);
        fetchCollections(userToken);
      } else {
        // Signup success -> auto login
        const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const loginData = await loginRes.json();
        if (loginRes.ok) {
          const userToken = loginData.accessToken;
          localStorage.setItem('token', userToken);
          setToken(userToken);
          setUser(loginData.user);
          setAuthPage('none');
          setAuthName('');
          setAuthEmail('');
          setAuthPassword('');
          setBackendOnline(true);
          fetchHistory(userToken);
          fetchCollections(userToken);
        } else {
          setAuthPage('login');
          setAuthError('Account created successfully! Please log in.');
        }
      }
    } catch (err) {
      console.error(err);
      setAuthError('Cannot connect to server. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Update tabs if backend status changes
  const checkBackendStatus = async (activeToken = token) => {
    try {
      const headers = activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {};
      const res = await fetch(`${BACKEND_URL}/api/history`, { headers });
      if (res.ok || res.status === 401) {
        setBackendOnline(true);
      } else {
        setBackendOnline(false);
      }
    } catch (e) {
      setBackendOnline(false);
    }
  };

  const fetchHistory = async (activeToken = token) => {
    if (!activeToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/history`, {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  };

  const fetchCollections = async (activeToken = token) => {
    if (!activeToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/collections`, {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCollections(data);
      }
    } catch (e) {
      console.error('Failed to fetch collections', e);
    }
  };

  // Helper: Create empty key-value row template
  const createEmptyRow = () => ({
    id: Math.random().toString(36).substring(2, 9),
    key: '',
    value: '',
    enabled: true
  });

  const createNewTab = (initialData = {}) => {
    const tabId = Math.random().toString(36).substring(2, 9);
    
    // Pre-populate empty rows for inputs
    const queryParams = initialData.queryParams && initialData.queryParams.length > 0 
      ? [...initialData.queryParams, createEmptyRow()] 
      : [createEmptyRow()];

    const headers = initialData.headers && initialData.headers.length > 0 
      ? [...initialData.headers, createEmptyRow()] 
      : [
          { id: 'h1', key: 'Content-Type', value: 'application/json', enabled: true },
          createEmptyRow()
        ];

    const formData = initialData.formData && initialData.formData.length > 0
      ? [...initialData.formData, createEmptyRow()]
      : [createEmptyRow()];

    return {
      id: tabId,
      name: initialData.name || 'New Request',
      method: initialData.method || 'GET',
      url: initialData.url || '',
      queryParams,
      headers,
      body: initialData.body || '',
      bodyType: initialData.bodyType || 'json',
      auth: initialData.auth || {
        type: 'none',
        token: '',
        username: '',
        password: '',
        apiKey: '',
        apiValue: '',
        apiLocation: 'header'
      },
      formData,
      response: null,
      loading: false,
      error: null,
      activeSectionTab: 'params',
      isSaved: !!initialData.collectionId,
      collectionId: initialData.collectionId || null,
      requestId: initialData.requestId || null
    };
  };

  const handleNewTab = () => {
    const newTab = createNewTab();
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = (tabIdToClose, e) => {
    e.stopPropagation();
    const index = tabs.findIndex(t => t.id === tabIdToClose);
    const newTabs = tabs.filter(t => t.id !== tabIdToClose);
    
    if (newTabs.length === 0) {
      const defaultTab = createNewTab();
      setTabs([defaultTab]);
      setActiveTabId(defaultTab.id);
      return;
    }

    setTabs(newTabs);
    
    if (activeTabId === tabIdToClose) {
      // Set active to the adjacent tab
      const newActiveIndex = index === 0 ? 0 : index - 1;
      setActiveTabId(newTabs[newActiveIndex].id);
    }
  };

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0] || null;

  // Update active tab properties
  const updateActiveTab = (updates) => {
    if (!activeTabId) return;
    setTabs(tabs.map(tab => {
      if (tab.id === activeTabId) {
        return { ...tab, ...updates };
      }
      return tab;
    }));
  };

  // Synchronize URL query parameters
  const handleUrlChange = (value) => {
    if (!activeTab) return;

    // Check if URL has query parameters
    const questionMarkIndex = value.indexOf('?');
    let newParams = [...activeTab.queryParams];
    
    if (questionMarkIndex !== -1) {
      const queryString = value.substring(questionMarkIndex + 1);
      const urlParams = new URLSearchParams(queryString);
      
      const parsedParams = [];
      for (const [key, val] of urlParams.entries()) {
        parsedParams.push({
          id: Math.random().toString(36).substring(2, 9),
          key,
          value: val,
          enabled: true
        });
      }
      
      // Merge parsed parameters with the existing empty row at the end
      newParams = [...parsedParams, createEmptyRow()];
    } else {
      // If no query string, check if we need to clear parameters
      // Keep only empty rows
      if (newParams.length > 1 || newParams[0]?.key !== '') {
        newParams = [createEmptyRow()];
      }
    }

    // Direct state update
    setTabs(tabs.map(tab => {
      if (tab.id === activeTabId) {
        return { ...tab, url: value, queryParams: newParams };
      }
      return tab;
    }));
  };

  // Rebuild URL from base and query parameters
  const rebuildUrl = (baseUrl, queryParams) => {
    const cleanBaseUrl = baseUrl.split('?')[0];
    const enabledParams = queryParams.filter(p => p.enabled && p.key.trim() !== '');
    
    if (enabledParams.length === 0) {
      return cleanBaseUrl;
    }

    const searchParams = new URLSearchParams();
    enabledParams.forEach(p => {
      searchParams.append(p.key.trim(), p.value);
    });

    const queryString = searchParams.toString();
    return queryString ? `${cleanBaseUrl}?${queryString}` : cleanBaseUrl;
  };

  // Key Value Table Handler
  const handleKvChange = (type, index, field, value) => {
    if (!activeTab) return;

    let list = [];
    if (type === 'params') list = [...activeTab.queryParams];
    else if (type === 'headers') list = [...activeTab.headers];
    else if (type === 'form-data') list = [...activeTab.formData];

    // Update row
    list[index] = { ...list[index], [field]: value };

    // Auto-add new row at the end if user edits the last row
    if (index === list.length - 1 && (list[index].key !== '' || list[index].value !== '')) {
      list.push(createEmptyRow());
    }

    const updates = {};
    if (type === 'params') {
      updates.queryParams = list;
      updates.url = rebuildUrl(activeTab.url, list);
    } else if (type === 'headers') {
      updates.headers = list;
    } else if (type === 'form-data') {
      updates.formData = list;
    }

    updateActiveTab(updates);
  };

  const handleRemoveKvRow = (type, index) => {
    if (!activeTab) return;

    let list = [];
    if (type === 'params') list = [...activeTab.queryParams];
    else if (type === 'headers') list = [...activeTab.headers];
    else if (type === 'form-data') list = [...activeTab.formData];

    // Prevent removing the last row if it's the only one
    if (list.length === 1) {
      list = [createEmptyRow()];
    } else {
      list.splice(index, 1);
    }

    const updates = {};
    if (type === 'params') {
      updates.queryParams = list;
      updates.url = rebuildUrl(activeTab.url, list);
    } else if (type === 'headers') {
      updates.headers = list;
    } else if (type === 'form-data') {
      updates.formData = list;
    }

    updateActiveTab(updates);
  };

  // Send Request Action
  const handleSendRequest = async () => {
    if (!activeTab || !activeTab.url) return;

    updateActiveTab({ loading: true, error: null, response: null });

    // Clean headers and parameters
    const cleanHeaders = {};
    activeTab.headers
      .filter(h => h.enabled && h.key.trim() !== '')
      .forEach(h => {
        cleanHeaders[h.key.trim()] = h.value;
      });

    let requestUrl = activeTab.url;
    const auth = activeTab.auth || { type: 'none' };
    if (auth.type === 'bearer' && auth.token) {
      cleanHeaders.Authorization = `Bearer ${auth.token}`;
    } else if (auth.type === 'basic') {
      const credentials = new TextEncoder().encode(`${auth.username || ''}:${auth.password || ''}`);
      cleanHeaders.Authorization = `Basic ${btoa(String.fromCharCode(...credentials))}`;
    } else if (auth.type === 'api-key' && auth.apiKey) {
      if (auth.apiLocation === 'query') {
        const separator = requestUrl.includes('?') ? '&' : '?';
        requestUrl += `${separator}${encodeURIComponent(auth.apiKey)}=${encodeURIComponent(auth.apiValue || '')}`;
      } else {
        cleanHeaders[auth.apiKey] = auth.apiValue || '';
      }
    }

    // Prepare Request Body
    let requestBody = undefined;
    if (activeTab.method !== 'GET' && activeTab.method !== 'HEAD') {
      if (activeTab.bodyType === 'json') {
        requestBody = activeTab.body;
      } else if (activeTab.bodyType === 'form-data') {
        requestBody = activeTab.formData.filter(f => f.enabled && f.key.trim() !== '');
      } else if (activeTab.bodyType === 'text' || activeTab.bodyType === 'raw') {
        requestBody = activeTab.body;
      }
    }

    const payload = {
      url: requestUrl,
      method: activeTab.method,
      headers: cleanHeaders,
      body: requestBody,
      bodyType: activeTab.bodyType
    };

    try {
      let data;
      
      if (backendOnline) {
        // Run via Proxy Backend to avoid CORS
        const res = await fetch(`${BACKEND_URL}/api/proxy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Request failed');
        }
      } else {
        // Fallback: Direct fetch in browser (subject to CORS limits)
        console.warn('Backend server offline. Making request directly from browser (CORS restrictions apply)');
        const startTime = performance.now();
        
        const fetchConfig = {
          method: activeTab.method,
          headers: cleanHeaders
        };
        
        if (payload.body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(activeTab.method)) {
          if (activeTab.bodyType === 'json') {
            fetchConfig.body = typeof payload.body === 'string' ? payload.body : JSON.stringify(payload.body);
            if (!fetchConfig.headers['Content-Type']) {
              fetchConfig.headers['Content-Type'] = 'application/json';
            }
          } else {
            fetchConfig.body = payload.body;
          }
        }

        const res = await fetch(requestUrl, fetchConfig);
        const endTime = performance.now();
        const durationMs = Math.round(endTime - startTime);

        const contentType = res.headers.get('content-type') || '';
        let bodyText;
        if (contentType.includes('application/json')) {
          bodyText = await res.json();
        } else {
          bodyText = await res.text();
        }

        const headersObj = {};
        res.headers.forEach((val, key) => {
          headersObj[key] = val;
        });

        data = {
          status: res.status,
          statusText: res.statusText,
          headers: headersObj,
          body: bodyText,
          time: durationMs,
          size: JSON.stringify(bodyText).length
        };
      }

      // Handle Success Response
      updateActiveTab({
        loading: false,
        response: data
      });

      // Save to History (background write)
      if (backendOnline && token) {
        await fetch(`${BACKEND_URL}/api/history`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            url: activeTab.url,
            method: activeTab.method
          })
        });
        fetchHistory(token);
      }

    } catch (err) {
      updateActiveTab({
        loading: false,
        error: err.message || 'An error occurred during request.'
      });
    }
  };

  // History & Collections Interactions
  const handleSelectHistoryItem = (item) => {
    const existingTab = tabs.find(t => t.url === item.url && t.method === item.method);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTab = createNewTab({
        name: item.url.replace(/https?:\/\//, '').split('/')[0] || 'Request',
        url: item.url,
        method: item.method
      });
      setTabs([...tabs, newTab]);
      setActiveTabId(newTab.id);
    }
  };

  const handleClearHistory = async () => {
    if (!backendOnline || !token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/history`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setHistory([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteHistoryItem = async (id, e) => {
    e.stopPropagation();
    if (!backendOnline || !token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/history/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setHistory(history.filter(item => item.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Save Modal Action
  // Save Modal Action
  const openSaveModal = () => {
    if (!activeTab) return;
    setSaveReqName(activeTab.name === 'New Request' ? '' : activeTab.name);
    if (activeTab.collectionId) {
      setSelectedColId(activeTab.collectionId);
    } else if (collections.length > 0) {
      setSelectedColId(collections[0].id);
    }
    setShowSaveModal(true);
  };

  const handleSave = async () => {
    if (!activeTab || !token) return;

    if (activeTab.isSaved && activeTab.collectionId && activeTab.requestId) {
      // Find the original request from the collections to check if method or URL changed
      const currentCollection = collections.find(c => c.id === activeTab.collectionId);
      const originalReq = currentCollection?.requests?.find(r => r.id === activeTab.requestId);
      
      const methodChanged = originalReq && originalReq.method !== activeTab.method;
      const urlChanged = originalReq && originalReq.url !== activeTab.url;

      if (methodChanged || urlChanged) {
        const confirmOverwrite = window.confirm(
          `You have changed the request ${methodChanged ? 'Method' : ''}${methodChanged && urlChanged ? ' and ' : ''}${urlChanged ? 'URL' : ''}.\n\n` +
          `Click 'OK' to OVERWRITE the existing request "${originalReq.name}".\n` +
          `Click 'Cancel' to save it as a NEW request instead.`
        );
        
        if (!confirmOverwrite) {
          handleSaveAs();
          return;
        }
      }

      // Direct Save (Update existing request) without opening modal!
      const reqPayload = {
        name: activeTab.name,
        url: activeTab.url,
        method: activeTab.method,
        headers: activeTab.headers.filter(h => h.key !== ''),
        body: activeTab.body,
        bodyType: activeTab.bodyType,
        auth: activeTab.auth,
        queryParams: activeTab.queryParams.filter(p => p.key !== '')
      };

      try {
        const res = await fetch(`${BACKEND_URL}/api/collections/${activeTab.collectionId}/requests/${activeTab.requestId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(reqPayload)
        });

        if (res.ok) {
          fetchCollections(token);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 2000);
        }
      } catch (err) {
        console.error('Error saving request:', err);
      }
    } else {
      // Opens the modal for new requests
      setIsSaveAs(false);
      openSaveModal();
    }
  };

  const handleSaveAs = () => {
    if (!activeTab) return;
    setIsSaveAs(true);
    setSaveReqName(activeTab.name === 'New Request' ? '' : activeTab.name);
    if (activeTab.collectionId) {
      setSelectedColId(activeTab.collectionId);
    } else if (collections.length > 0) {
      setSelectedColId(collections[0].id);
    }
    setShowSaveModal(true);
  };

  const handleAddRequestToCollection = (colId, e) => {
    e.stopPropagation();
    
    // Create new tab pre-linked to this collection
    const newTab = createNewTab({
      name: 'New Request',
      collectionId: colId,
      isSaved: false
    });
    
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
    
    // Expand the collection folder so they can see it
    setExpandedCollections(prev => ({
      ...prev,
      [colId]: true
    }));
  };

  const handleSaveRequest = async () => {
    if (!activeTab || !saveReqName.trim() || !token || isSaving) return;

    setIsSaving(true);
    let targetColId = selectedColId;

    // Fallback: If targetColId is empty but we have collections, default to the first one!
    if (!targetColId && collections.length > 0) {
      targetColId = collections[0].id;
    }

    // Create collection if none selected/exists
    if (!targetColId && collections.length === 0) {
      try {
        const colRes = await fetch(`${BACKEND_URL}/api/collections`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name: 'My Collection' })
        });
        if (colRes.ok) {
          const colData = await colRes.json();
          targetColId = colData.id;
          await fetchCollections(token);
        }
      } catch (err) {
        console.error(err);
        setIsSaving(false);
        return;
      }
    }

    if (!targetColId) {
      setIsSaving(false);
      return;
    }

    const reqPayload = {
      name: saveReqName.trim(),
      url: activeTab.url,
      method: activeTab.method,
      headers: activeTab.headers.filter(h => h.key !== ''),
      body: activeTab.body,
      bodyType: activeTab.bodyType,
      auth: activeTab.auth,
      queryParams: activeTab.queryParams.filter(p => p.key !== '')
    };

    try {
      let res;
      if (!isSaveAs && activeTab.isSaved && activeTab.collectionId && activeTab.requestId) {
        // Update existing request
        res = await fetch(`${BACKEND_URL}/api/collections/${activeTab.collectionId}/requests/${activeTab.requestId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(reqPayload)
        });
      } else {
        // Add new request
        res = await fetch(`${BACKEND_URL}/api/collections/${targetColId}/requests`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(reqPayload)
        });
      }

      if (res.ok) {
        const savedReq = await res.json();
        updateActiveTab({
          name: savedReq.name,
          isSaved: true,
          collectionId: targetColId,
          requestId: savedReq.id
        });
        fetchCollections(token);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        setShowSaveModal(false);
      }
    } catch (err) {
      console.error('Error saving request:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Create Collection
  const handleCreateCollection = async () => {
    if (!newColName.trim() || !token || isCreatingCollection) return;

    setIsCreatingCollection(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/collections`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newColName.trim(),
          description: newColDesc.trim()
        })
      });

      if (res.ok) {
        fetchCollections(token);
        setShowCollectionModal(false);
        setNewColName('');
        setNewColDesc('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingCollection(false);
    }
  };

  const handleDeleteCollection = async (id, e) => {
    e.stopPropagation();
    if (!token) return;
    if (!window.confirm('Delete this collection and all its requests?')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/collections/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchCollections(token);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCollectionRequest = async (colId, reqId, e) => {
    e.stopPropagation();
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/collections/${colId}/requests/${reqId}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchCollections(token);
        // If current active tab is the deleted request, set isSaved = false
        if (activeTab && activeTab.requestId === reqId) {
          updateActiveTab({ isSaved: false, collectionId: null, requestId: null });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectCollectionRequest = (colId, req) => {
    const existingTab = tabs.find(t => t.requestId === req.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTab = createNewTab({
        name: req.name,
        url: req.url,
        method: req.method,
        queryParams: req.queryParams,
        headers: req.headers,
        body: req.body,
        bodyType: req.bodyType,
        auth: req.auth,
        collectionId: colId,
        requestId: req.id
      });
      setTabs([...tabs, newTab]);
      setActiveTabId(newTab.id);
    }
  };

  const toggleExpandCollection = (colId) => {
    setExpandedCollections({
      ...expandedCollections,
      [colId]: !expandedCollections[colId]
    });
  };

  // Syntax highlighting for JSON responses
  const highlightJson = (jsonStr) => {
    if (!jsonStr) return '';
    try {
      let formatted = typeof jsonStr === 'string' ? jsonStr : JSON.stringify(jsonStr, null, 2);
      
      // Escape HTML characters
      let safeStr = formatted
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
        
      return safeStr.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
        (match) => {
          let cls = 'json-number';
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = 'json-key';
            } else {
              cls = 'json-string';
            }
          } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
          } else if (/null/.test(match)) {
            cls = 'json-null';
          }
          if (cls === 'json-key') {
            return `<span class="${cls}">${match.replace(/:$/, '')}</span>:`;
          }
          return `<span class="${cls}">${match}</span>`;
        }
      );
    } catch (e) {
      return String(jsonStr);
    }
  };

  // Copy response body
  const copyToClipboard = (text, id) => {
    if (!text) return;
    const str = typeof text === 'object' ? JSON.stringify(text, null, 2) : String(text);
    navigator.clipboard.writeText(str).then(() => {
      setCopiedTabId(id);
      setTimeout(() => setCopiedTabId(null), 2000);
    });
  };

  // Search filter
  const filteredHistory = history.filter(item => 
    item.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.method.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCollections = collections.filter(col => 
    col.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    col.requests.some(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.url.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (authPage !== 'none') {
    return (
      <div className="auth-wrapper">
        <div className="auth-container">
          <div className="auth-left">
            <div className="auth-brand">
              <Layers className="auth-logo-icon" size={24} />
              <span className="auth-brand-name">Postman API Sandbox</span>
              <span className="auth-brand-badge">CLOUD</span>
            </div>
            <div className="auth-hero-text">
              <h1>Advanced Request Sandbox & Cloud Sync</h1>
              <p>Sign in to sync your custom collections, execute queries, build requests, and check history securely on our private cloud server.</p>
            </div>
            <div className="auth-features">
              <div className="auth-feature">
                <Check size={16} className="feature-check" />
                <span>Private Cloud Syncing for Collections</span>
              </div>
              <div className="auth-feature">
                <Check size={16} className="feature-check" />
                <span>Isolated User Workspaces</span>
              </div>
              <div className="auth-feature">
                <Check size={16} className="feature-check" />
                <span>Proxy Client with CORS bypass</span>
              </div>
            </div>
          </div>
          <div className="auth-right">
            <div className="auth-card">
              <div className="auth-card-header">
                <h2>{authPage === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
                <p>{authPage === 'login' ? 'Sign in to access your dashboard' : 'Get started for free today'}</p>
              </div>
              
              {authError && (
                <div className="auth-error-box">
                  <AlertCircle size={16} />
                  <span>{authError}</span>
                </div>
              )}
              
              <form onSubmit={handleAuthSubmit} className="auth-form">
                {authPage === 'signup' && (
                  <div className="auth-input-group">
                    <label>Full Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Jane Doe" 
                      value={authName} 
                      onChange={e => setAuthName(e.target.value)}
                      required
                    />
                  </div>
                )}
                
                <div className="auth-input-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    placeholder="name@example.com" 
                    value={authEmail} 
                    onChange={e => setAuthEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="auth-input-group">
                  <label>Password</label>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={authPassword} 
                    onChange={e => setAuthPassword(e.target.value)}
                    required
                  />
                </div>
                
                <button type="submit" className="auth-submit-btn" disabled={authLoading}>
                  {authLoading ? (
                    <RefreshCw className="rotate-spinner" size={16} />
                  ) : (
                    authPage === 'login' ? 'Sign In' : 'Create Account'
                  )}
                </button>
              </form>
              
              <div className="auth-card-footer">
                <span>
                  {authPage === 'login' ? "Don't have an account? " : "Already have an account? "}
                  <button 
                    className="auth-switch-btn" 
                    onClick={() => {
                      setAuthPage(authPage === 'login' ? 'signup' : 'login');
                      setAuthError('');
                    }}
                  >
                    {authPage === 'login' ? 'Sign Up' : 'Log In'}
                  </button>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="root">
      {/* App Header */}
      <header className="app-header">
        <div className="logo-section">
          <Layers size={20} className="logo-icon" />
          <span className="logo-text">Postman API Client</span>
          <span className="logo-badge">Clone</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="server-status">
            <div className={`status-dot ${backendOnline ? 'online' : 'offline'}`}></div>
            <span>Proxy backend: {backendOnline ? 'CONNECTED' : 'OFFLINE (CORS active)'}</span>
          </div>
          {user && (
            <div className="user-profile-section">
              <div className="user-avatar">
                {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
              </div>
              <div className="user-info-text">
                <span className="user-name">{user.name}</span>
                <span className="user-email">{user.email}</span>
              </div>
              <button className="logout-btn" onClick={handleLogout}>Log Out</button>
            </div>
          )}
        </div>
      </header>

      <div className="app-container">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-tabs">
            <div 
              className={`sidebar-tab ${sidebarTab === 'history' ? 'active' : ''}`}
              onClick={() => setSidebarTab('history')}
            >
              <HistoryIcon size={14} />
              History
            </div>
            <div 
              className={`sidebar-tab ${sidebarTab === 'collections' ? 'active' : ''}`}
              onClick={() => setSidebarTab('collections')}
            >
              <Layers size={14} />
              Collections
            </div>
          </div>

          <div className="sidebar-content">
            <div className="sidebar-actions">
              <div className="search-bar">
                <Search size={14} />
                <input 
                  type="text" 
                  placeholder={`Search ${sidebarTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {sidebarTab === 'collections' && (
                <button 
                  className="btn-icon-action" 
                  title="Create Collection"
                  onClick={() => setShowCollectionModal(true)}
                >
                  <FolderPlus size={16} />
                </button>
              )}
              {sidebarTab === 'history' && history.length > 0 && (
                <button 
                  className="btn-icon-action" 
                  title="Clear History"
                  onClick={handleClearHistory}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {/* Sidebar list rendering */}
            {sidebarTab === 'history' ? (
              <div className="history-list">
                {filteredHistory.length === 0 ? (
                  <div className="empty-state">
                    <HistoryIcon size={24} />
                    <span>No history items. Send a request to start.</span>
                  </div>
                ) : (
                  filteredHistory.map(item => (
                    <div 
                      key={item.id} 
                      className="history-item"
                      onClick={() => handleSelectHistoryItem(item)}
                    >
                      <div className="history-req-info">
                        <span className={`method-badge ${item.method.toLowerCase()}`}>{item.method}</span>
                        <span className="history-url" title={item.url}>{item.url}</span>
                      </div>
                      <button 
                        className="delete-btn"
                        onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="collection-list">
                {filteredCollections.length === 0 ? (
                  <div className="empty-state">
                    <Layers size={24} />
                    <span>No collections found. Create one.</span>
                  </div>
                ) : (
                  filteredCollections.map(col => {
                    const isExpanded = expandedCollections[col.id];
                    return (
                      <div key={col.id} className="collection-folder">
                        <div 
                          className="collection-title-container"
                          onClick={() => toggleExpandCollection(col.id)}
                        >
                          <div className="collection-meta">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span title={col.description}>{col.name}</span>
                            <span className="collection-req-count">{col.requests?.length || 0}</span>
                          </div>
                          <div className="collection-actions">
                            <button 
                              className="add-req-btn"
                              title="Add Request"
                              onClick={(e) => handleAddRequestToCollection(col.id, e)}
                            >
                              <Plus size={14} />
                            </button>
                            <button 
                              className="delete-btn"
                              title="Delete Collection"
                              onClick={(e) => handleDeleteCollection(col.id, e)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="collection-reqs">
                            {col.requests?.length === 0 ? (
                              <div className="empty-state" style={{ padding: '16px' }}>
                                <span>No requests in collection.</span>
                              </div>
                            ) : (
                              col.requests.map(req => (
                                <div 
                                  key={req.id}
                                  className={`collection-req-item ${activeTab && activeTab.requestId === req.id ? 'active' : ''}`}
                                  onClick={() => handleSelectCollectionRequest(col.id, req)}
                                >
                                  <div className="history-req-info">
                                    <span className={`method-badge ${req.method.toLowerCase()}`} style={{ width: '42px', fontSize: '9px' }}>{req.method}</span>
                                    <span className="history-url" style={{ fontSize: '11px' }}>{req.name}</span>
                                  </div>
                                  <button 
                                    className="delete-btn"
                                    onClick={(e) => handleDeleteCollectionRequest(col.id, req.id, e)}
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Workspace panel */}
        <main className="main-workspace">
          {/* Tabs header bar */}
          <div className="tabs-bar">
            {tabs.map(tab => (
              <div 
                key={tab.id}
                className={`workspace-tab ${activeTabId === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTabId(tab.id)}
              >
                <span className={`method-badge ${tab.method.toLowerCase()}`} style={{ width: 'auto', padding: '0 4px', fontSize: '9px', height: '16px', lineHeight: '16px' }}>{tab.method}</span>
                <span>{tab.name}</span>
                <button 
                  className="workspace-tab-close"
                  onClick={(e) => handleCloseTab(tab.id, e)}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            <button className="new-tab-btn" onClick={handleNewTab}>
              <Plus size={16} />
            </button>
          </div>

          {activeTab && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {/* Request address bar panel */}
              <div className="request-builder">
                <div className="address-bar">
                  <select 
                    className={`method-select ${activeTab.method.toLowerCase()}`}
                    value={activeTab.method}
                    onChange={(e) => updateActiveTab({ method: e.target.value })}
                  >
                    <option value="GET" className="get">GET</option>
                    <option value="POST" className="post">POST</option>
                    <option value="PUT" className="put">PUT</option>
                    <option value="DELETE" className="delete">DELETE</option>
                    <option value="PATCH" className="patch">PATCH</option>
                    <option value="HEAD">HEAD</option>
                    <option value="OPTIONS">OPTIONS</option>
                  </select>

                  <input 
                    type="text" 
                    className="url-input" 
                    placeholder="Enter URL or paste API link (e.g. https://api.github.com/users/octocat)" 
                    value={activeTab.url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                  />

                  <button 
                    className="send-btn"
                    disabled={activeTab.loading || !activeTab.url}
                    onClick={handleSendRequest}
                  >
                    {activeTab.loading ? (
                      <RefreshCw size={14} className="rotate-spinner" />
                    ) : (
                      <Send size={14} />
                    )}
                    Send
                  </button>

                  {backendOnline && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="save-btn" onClick={handleSave} disabled={saveSuccess}>
                        {saveSuccess ? (
                          <Check size={14} style={{ color: 'var(--color-post)' }} />
                        ) : (
                          <Save size={14} />
                        )}
                        {saveSuccess ? 'Saved!' : 'Save'}
                      </button>
                      {activeTab.isSaved && (
                        <button className="save-btn" onClick={handleSaveAs} title="Save as a new request" disabled={saveSuccess}>
                          <Copy size={14} />
                          Save As
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Sub Panels (Parameters, headers, body / Response) */}
              <div className="workspace-panes">
                {/* Editor Section */}
                <div className="editor-pane">
                  <div className="section-tabs">
                    <div 
                      className={`section-tab ${activeTab.activeSectionTab === 'params' ? 'active' : ''}`}
                      onClick={() => updateActiveTab({ activeSectionTab: 'params' })}
                    >
                      Params
                    </div>
                    <div 
                      className={`section-tab ${activeTab.activeSectionTab === 'headers' ? 'active' : ''}`}
                      onClick={() => updateActiveTab({ activeSectionTab: 'headers' })}
                    >
                      Headers
                    </div>
                    <div
                      className={`section-tab ${activeTab.activeSectionTab === 'auth' ? 'active' : ''}`}
                      onClick={() => updateActiveTab({ activeSectionTab: 'auth' })}
                    >
                      Authorization
                    </div>
                    {['POST', 'PUT', 'PATCH', 'DELETE'].includes(activeTab.method) && (
                      <div 
                        className={`section-tab ${activeTab.activeSectionTab === 'body' ? 'active' : ''}`}
                        onClick={() => updateActiveTab({ activeSectionTab: 'body' })}
                      >
                        Body
                      </div>
                    )}
                  </div>

                  <div className="tab-content">
                    {activeTab.activeSectionTab === 'auth' && (
                      <div className="auth-editor">
                        <label className="auth-field">
                          <span>Auth Type</span>
                          <select
                            className="auth-input"
                            value={activeTab.auth.type}
                            onChange={(e) => updateActiveTab({ auth: { ...activeTab.auth, type: e.target.value } })}
                          >
                            <option value="none">No Auth</option>
                            <option value="bearer">Bearer Token</option>
                            <option value="basic">Basic Auth</option>
                            <option value="api-key">API Key</option>
                          </select>
                        </label>

                        {activeTab.auth.type === 'none' && (
                          <div className="auth-hint">This request will be sent without authorization.</div>
                        )}

                        {activeTab.auth.type === 'bearer' && (
                          <label className="auth-field">
                            <span>Token</span>
                            <input className="auth-input" type="password" value={activeTab.auth.token}
                              placeholder="Enter bearer token"
                              onChange={(e) => updateActiveTab({ auth: { ...activeTab.auth, token: e.target.value } })} />
                          </label>
                        )}

                        {activeTab.auth.type === 'basic' && (
                          <>
                            <label className="auth-field"><span>Username</span>
                              <input className="auth-input" value={activeTab.auth.username}
                                onChange={(e) => updateActiveTab({ auth: { ...activeTab.auth, username: e.target.value } })} />
                            </label>
                            <label className="auth-field"><span>Password</span>
                              <input className="auth-input" type="password" value={activeTab.auth.password}
                                onChange={(e) => updateActiveTab({ auth: { ...activeTab.auth, password: e.target.value } })} />
                            </label>
                          </>
                        )}

                        {activeTab.auth.type === 'api-key' && (
                          <>
                            <label className="auth-field"><span>Key</span>
                              <input className="auth-input" value={activeTab.auth.apiKey} placeholder="x-api-key"
                                onChange={(e) => updateActiveTab({ auth: { ...activeTab.auth, apiKey: e.target.value } })} />
                            </label>
                            <label className="auth-field"><span>Value</span>
                              <input className="auth-input" type="password" value={activeTab.auth.apiValue}
                                onChange={(e) => updateActiveTab({ auth: { ...activeTab.auth, apiValue: e.target.value } })} />
                            </label>
                            <label className="auth-field"><span>Add to</span>
                              <select className="auth-input" value={activeTab.auth.apiLocation}
                                onChange={(e) => updateActiveTab({ auth: { ...activeTab.auth, apiLocation: e.target.value } })}>
                                <option value="header">Header</option>
                                <option value="query">Query Params</option>
                              </select>
                            </label>
                          </>
                        )}
                      </div>
                    )}

                    {/* Params editor */}
                    {activeTab.activeSectionTab === 'params' && (
                      <table className="kv-editor">
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}></th>
                            <th>Key</th>
                            <th>Value</th>
                            <th style={{ width: '40px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeTab.queryParams.map((param, index) => (
                            <tr key={param.id}>
                              <td style={{ textAlign: 'center' }}>
                                <input 
                                  type="checkbox" 
                                  className="kv-checkbox"
                                  checked={param.enabled}
                                  onChange={(e) => handleKvChange('params', index, 'enabled', e.target.checked)}
                                />
                              </td>
                              <td>
                                <input 
                                  type="text" 
                                  className="kv-input" 
                                  placeholder="Parameter Key"
                                  value={param.key}
                                  onChange={(e) => handleKvChange('params', index, 'key', e.target.value)}
                                />
                              </td>
                              <td>
                                <input 
                                  type="text" 
                                  className="kv-input" 
                                  placeholder="Value"
                                  value={param.value}
                                  onChange={(e) => handleKvChange('params', index, 'value', e.target.value)}
                                />
                              </td>
                              <td>
                                <button 
                                  className="delete-btn"
                                  style={{ opacity: index === activeTab.queryParams.length - 1 ? 0 : 1 }}
                                  onClick={() => handleRemoveKvRow('params', index)}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Headers editor */}
                    {activeTab.activeSectionTab === 'headers' && (
                      <table className="kv-editor">
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}></th>
                            <th>Key</th>
                            <th>Value</th>
                            <th style={{ width: '40px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeTab.headers.map((header, index) => (
                            <tr key={header.id}>
                              <td style={{ textAlign: 'center' }}>
                                <input 
                                  type="checkbox" 
                                  className="kv-checkbox"
                                  checked={header.enabled}
                                  onChange={(e) => handleKvChange('headers', index, 'enabled', e.target.checked)}
                                />
                              </td>
                              <td>
                                <input 
                                  type="text" 
                                  className="kv-input" 
                                  placeholder="Header Key"
                                  value={header.key}
                                  onChange={(e) => handleKvChange('headers', index, 'key', e.target.value)}
                                />
                              </td>
                              <td>
                                <input 
                                  type="text" 
                                  className="kv-input" 
                                  placeholder="Value"
                                  value={header.value}
                                  onChange={(e) => handleKvChange('headers', index, 'value', e.target.value)}
                                />
                              </td>
                              <td>
                                <button 
                                  className="delete-btn"
                                  style={{ opacity: index === activeTab.headers.length - 1 ? 0 : 1 }}
                                  onClick={() => handleRemoveKvRow('headers', index)}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Body editor */}
                    {activeTab.activeSectionTab === 'body' && (
                      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div className="body-type-select">
                          <label className="body-type-radio">
                            <input 
                              type="radio" 
                              name="bodyType" 
                              checked={activeTab.bodyType === 'none'} 
                              onChange={() => updateActiveTab({ bodyType: 'none' })}
                            />
                            none
                          </label>
                          <label className="body-type-radio">
                            <input 
                              type="radio" 
                              name="bodyType" 
                              checked={activeTab.bodyType === 'json'} 
                              onChange={() => updateActiveTab({ bodyType: 'json' })}
                            />
                            JSON
                          </label>
                          <label className="body-type-radio">
                            <input 
                              type="radio" 
                              name="bodyType" 
                              checked={activeTab.bodyType === 'form-data'} 
                              onChange={() => updateActiveTab({ bodyType: 'form-data' })}
                            />
                            form-data
                          </label>
                          <label className="body-type-radio">
                            <input 
                              type="radio" 
                              name="bodyType" 
                              checked={activeTab.bodyType === 'raw'} 
                              onChange={() => updateActiveTab({ bodyType: 'raw' })}
                            />
                            Raw
                          </label>
                          <label className="body-type-radio">
                            <input 
                              type="radio" 
                              name="bodyType" 
                              checked={activeTab.bodyType === 'text'} 
                              onChange={() => updateActiveTab({ bodyType: 'text' })}
                            />
                            Text
                          </label>
                        </div>

                        {activeTab.bodyType === 'none' && (
                          <div className="empty-state" style={{ padding: '24px' }}>
                            <span>This request does not have a body.</span>
                          </div>
                        )}

                        {(['json', 'raw', 'text'].includes(activeTab.bodyType)) && (
                          <textarea 
                            className="raw-body-textarea"
                            placeholder={activeTab.bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Enter raw body data here'}
                            value={activeTab.body}
                            onChange={(e) => updateActiveTab({ body: e.target.value })}
                          />
                        )}

                        {activeTab.bodyType === 'form-data' && (
                          <table className="kv-editor">
                            <thead>
                              <tr>
                                <th style={{ width: '40px' }}></th>
                                <th>Key</th>
                                <th>Value</th>
                                <th style={{ width: '40px' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeTab.formData.map((fd, index) => (
                                <tr key={fd.id}>
                                  <td style={{ textAlign: 'center' }}>
                                    <input 
                                      type="checkbox" 
                                      className="kv-checkbox"
                                      checked={fd.enabled}
                                      onChange={(e) => handleKvChange('form-data', index, 'enabled', e.target.checked)}
                                    />
                                  </td>
                                  <td>
                                    <input 
                                      type="text" 
                                      className="kv-input" 
                                      placeholder="Key"
                                      value={fd.key}
                                      onChange={(e) => handleKvChange('form-data', index, 'key', e.target.value)}
                                    />
                                  </td>
                                  <td>
                                    <input 
                                      type="text" 
                                      className="kv-input" 
                                      placeholder="Value"
                                      value={fd.value}
                                      onChange={(e) => handleKvChange('form-data', index, 'value', e.target.value)}
                                    />
                                  </td>
                                  <td>
                                    <button 
                                      className="delete-btn"
                                      style={{ opacity: index === activeTab.formData.length - 1 ? 0 : 1 }}
                                      onClick={() => handleRemoveKvRow('form-data', index)}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Response Section */}
                <div className="response-pane">
                  {activeTab.response ? (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                      <div className="response-header-info">
                        <div className="response-status-badge">
                          <span className={`status-badge ${activeTab.response.status >= 200 && activeTab.response.status < 300 ? 'success' : 'error'}`}>
                            Status: {activeTab.response.status} {activeTab.response.statusText}
                          </span>
                        </div>
                        <div className="response-meta-stats">
                          <div className="meta-stat">
                            Time: <span>{activeTab.response.time} ms</span>
                          </div>
                          <div className="meta-stat">
                            Size: <span>{(activeTab.response.size / 1024).toFixed(2)} KB</span>
                          </div>
                          <button 
                            className="btn-icon-action" 
                            title="Copy Response"
                            onClick={() => copyToClipboard(activeTab.response.body, activeTab.id)}
                            style={{ border: 'none', height: '24px', width: '24px' }}
                          >
                            {copiedTabId === activeTab.id ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>

                      <div className="response-body-container">
                        {typeof activeTab.response.body === 'string' && activeTab.response.body.startsWith('data:image/') ? (
                          <img 
                            src={activeTab.response.body} 
                            alt="API Response visual" 
                            className="response-image" 
                          />
                        ) : (
                          <pre 
                            className="json-viewer"
                            dangerouslySetInnerHTML={{ __html: highlightJson(activeTab.response.body) }}
                          />
                        )}
                      </div>
                    </div>
                  ) : activeTab.error ? (
                    <div className="no-response-placeholder" style={{ color: '#ef4444' }}>
                      <AlertCircle size={36} />
                      <span style={{ fontWeight: 600 }}>Error: {activeTab.error}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Check network connection or server endpoint configuration.</span>
                    </div>
                  ) : activeTab.loading ? (
                    <div className="no-response-placeholder">
                      <RefreshCw size={36} className="rotate-spinner" style={{ color: 'var(--color-orange)' }} />
                      <span>Sending API request...</span>
                    </div>
                  ) : (
                    <div className="no-response-placeholder">
                      <Play size={36} />
                      <span>Click the 'Send' button to execute the API call</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* SAVE REQUEST MODAL */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <span className="modal-title">{isSaveAs ? 'Save Request As' : 'Save Request'}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Request Name</label>
              <input 
                type="text" 
                className="modal-input" 
                value={saveReqName}
                onChange={(e) => setSaveReqName(e.target.value)}
                placeholder="Enter request name"
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Select Collection</label>
              {collections.length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No collections found. A new collection "My Collection" will be created.</span>
              ) : (
                <select 
                  className="modal-input"
                  value={selectedColId}
                  onChange={(e) => setSelectedColId(e.target.value)}
                >
                  {collections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowSaveModal(false)}>Cancel</button>
              <button 
                className="btn-primary" 
                onClick={handleSaveRequest}
                disabled={!saveReqName.trim() || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE COLLECTION MODAL */}
      {showCollectionModal && (
        <div className="modal-overlay" onClick={() => setShowCollectionModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <span className="modal-title">Create Collection</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Collection Name</label>
              <input 
                type="text" 
                className="modal-input" 
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="e.g. User APIs"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Description (Optional)</label>
              <input 
                type="text" 
                className="modal-input" 
                value={newColDesc}
                onChange={(e) => setNewColDesc(e.target.value)}
                placeholder="Brief details about the API collection"
              />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCollectionModal(false)}>Cancel</button>
              <button 
                className="btn-primary" 
                onClick={handleCreateCollection}
                disabled={!newColName.trim() || isCreatingCollection}
              >
                {isCreatingCollection ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
