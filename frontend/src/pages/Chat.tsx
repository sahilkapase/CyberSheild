import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Box, Typography, Paper, TextField, Button, Avatar, 
  List, ListItem, ListItemAvatar, ListItemText, Divider,
  Alert, Snackbar, IconButton, ListItemButton, Chip, Badge,
  InputAdornment, LinearProgress, Tooltip
} from '@mui/material';
import { 
  Send as SendIcon, 
  Person as PersonIcon,
  Circle as OnlineIcon,
  Refresh as RefreshIcon,
  Notifications as NotificationIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const deriveDefaultWsBase = (apiBase: string) => {
  try {
    const url = new URL(apiBase);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    if (apiBase.startsWith('https://')) {
      return apiBase.replace('https://', 'wss://');
    }
    if (apiBase.startsWith('http://')) {
      return apiBase.replace('http://', 'ws://');
    }
    return apiBase;
  }
};

const WS_BASE_URL = (process.env.REACT_APP_WEBSOCKET_URL || deriveDefaultWsBase(API_BASE_URL)).replace(/\/$/, '');

interface User {
  id: number;
  username: string;
  full_name: string;
}

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  created_at: string;
  is_abusive: boolean;
  abuse_score: number;
}

interface AlertState {
  type: 'warning' | 'error' | 'info' | 'success';
  message: string;
  open: boolean;
}

const Chat: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  const { user } = useAuth();
  const { incrementUnread, decrementUnread } = useNotifications();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [alert, setAlert] = useState<AlertState>({ type: 'info', message: '', open: false });
  const [unreadCounts, setUnreadCounts] = useState<{[userId: number]: number}>({});
  const [contactSearch, setContactSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const filteredUsers = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) {
      return users;
    }
    return users.filter((u) =>
      u.username.toLowerCase().includes(query) ||
      u.full_name.toLowerCase().includes(query)
    );
  }, [users, contactSearch]);

  interface ConversationStats {
    totalMessages: number;
    abusiveCount: number;
    abusePercentage: number;
    lastMessageTime: string | null;
    averageResponseMs: number | null;
  }

  const conversationStats = useMemo<ConversationStats>(() => {
    if (!messages.length || !selectedUser) {
      return {
        totalMessages: 0,
        abusiveCount: 0,
        abusePercentage: 0,
        lastMessageTime: null,
        averageResponseMs: null
      };
    }

    const totalMessages = messages.length;
    const abusiveCount = messages.filter((m) => m.is_abusive).length;
    const abusePercentage = totalMessages ? (abusiveCount / totalMessages) * 100 : 0;
    const lastMessageTime = messages[messages.length - 1]?.created_at ?? null;

    let cumulativeResponse = 0;
    let responseSwaps = 0;
    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];
      const previous = messages[i - 1];
      if (current.sender_id !== previous.sender_id) {
        const diff =
          new Date(current.created_at).getTime() -
          new Date(previous.created_at).getTime();
        if (diff > 0 && diff < 1000 * 60 * 60 * 24) {
          cumulativeResponse += diff;
          responseSwaps += 1;
        }
      }
    }

    return {
      totalMessages,
      abusiveCount,
      abusePercentage,
      lastMessageTime,
      averageResponseMs: responseSwaps ? cumulativeResponse / responseSwaps : null
    };
  }, [messages, selectedUser]);

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (!user || !selectedUser) return;

    // Disconnect existing socket first
    if (socket) {
      socket.close();
      setSocket(null);
    }

    setConnectionStatus('connecting');
    const ws = new WebSocket(`${WS_BASE_URL}/ws/${user.id}`);
    
    ws.onopen = () => {
      console.log('WebSocket connection established');
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle different message types
        if (data.type === 'alert') {
          setAlert({
            type: data.severity === 'critical' ? 'error' : 'warning',
            message: data.message,
            open: true
          });
          return;
        }
        
        // Handle regular messages
        if (
          (data.sender_id === selectedUser.id && data.receiver_id === user.id) ||
          (data.sender_id === user.id && data.receiver_id === selectedUser.id)
        ) {
          setMessages(prev => [...prev, data]);
          
          // If message is from another user (not current user), show notification
          if (data.sender_id !== user.id) {
            // Show browser notification if permission granted
            if (Notification.permission === 'granted') {
              const senderName = selectedUser.full_name || selectedUser.username;
              new Notification(`New message from ${senderName}`, {
                body: data.content,
                icon: '/favicon.ico'
              });
            }
            
            // Show in-app alert
            setAlert({
              type: 'info',
              message: `New message from ${selectedUser.full_name || selectedUser.username}`,
              open: true
            });
          }
        } else if (data.sender_id !== user.id) {
          // Message from a different conversation - update unread count
          setUnreadCounts(prev => ({
            ...prev,
            [data.sender_id]: (prev[data.sender_id] || 0) + 1
          }));
          
          // Increment global notification count
          incrementUnread();
          
          // Show notification for message from other users
          if (Notification.permission === 'granted') {
            const senderUser = users.find(u => u.id === data.sender_id);
            const senderName = senderUser?.full_name || senderUser?.username || 'Someone';
            new Notification(`New message from ${senderName}`, {
              body: data.content,
              icon: '/favicon.ico'
            });
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Don't set state here to avoid infinite loops
    };
    
    ws.onclose = (event) => {
      console.log('WebSocket connection closed', event.code, event.reason);
      setConnectionStatus('disconnected');
      
      // Only attempt to reconnect if it wasn't a manual close and we haven't exceeded attempts
      if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        
        console.log(`Scheduling reconnection attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts} in ${delay}ms`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (user && selectedUser) { // Check if still valid before reconnecting
            connectWebSocket();
          }
        }, delay);
      }
    };
    
    setSocket(ws);
  }, [user, selectedUser, socket, maxReconnectAttempts, incrementUnread, users]);

  const disconnectWebSocket = useCallback(() => {
    if (socket) {
      socket.close();
      setSocket(null);
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setConnectionStatus('disconnected');
  }, [socket]);

  // Request notification permission
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Fetch friends list (or all users for admin)
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        let response;
        if (user?.is_admin) {
          // Admin can see all users
          response = await axios.get('/api/users');
          // Filter out current user
          const filteredUsers = response.data.filter((u: User) => u.id !== user?.id);
          setUsers(filteredUsers);
        } else {
          // Regular users can only see friends
          response = await axios.get('/api/friends/list');
          setUsers(response.data);
        }
        
        // If userId is provided in URL, select that user
        if (userId) {
          const userToSelect = response.data.find((u: User) => u.id === parseInt(userId));
          if (userToSelect) {
            setSelectedUser(userToSelect);
          }
        }
      } catch (error) {
        console.error('Error fetching contacts:', error);
      }
    };

    fetchContacts();
  }, [userId, user?.id, user?.is_admin]);

  // Connect to WebSocket when user is selected
  useEffect(() => {
    if (selectedUser && user) {
      // Disconnect existing socket
      disconnectWebSocket();
      
      // Fetch conversation history
      const fetchMessages = async () => {
        try {
          const response = await axios.get(`/api/messages/conversation/${selectedUser.id}`);
          setMessages(response.data);
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      };
      
      fetchMessages();
      
      // Connect WebSocket after a small delay to ensure cleanup is complete
      const timer = setTimeout(() => {
        connectWebSocket();
      }, 100);
      
      // Cleanup function
      return () => {
        clearTimeout(timer);
        disconnectWebSocket();
      };
    }
  }, [selectedUser, user, connectWebSocket, disconnectWebSocket]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleUserSelect = (selectedUser: User) => {
    setSelectedUser(selectedUser);
    
    // Get current unread count for this user
    const currentUnread = unreadCounts[selectedUser.id] || 0;
    
    // Clear unread count for this user
    setUnreadCounts(prev => ({
      ...prev,
      [selectedUser.id]: 0
    }));
    
    // Decrement global notification count by the amount we're clearing
    for (let i = 0; i < currentUnread; i++) {
      decrementUnread();
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedUser || !socket || !user) return;
    
    const messageData = {
      id: Date.now(), // Temporary ID until we get the real one from server
      sender_id: user.id,
      receiver_id: selectedUser.id,
      content: newMessage,
      created_at: new Date().toISOString(),
      is_abusive: false,
      abuse_score: 0
    };
    
    // Add message to local state immediately for sender
    setMessages(prev => [...prev, messageData]);
    
    // Send via WebSocket
    socket.send(JSON.stringify({
      sender_id: user.id,
      receiver_id: selectedUser.id,
      content: newMessage
    }));
    
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCloseAlert = () => {
    setAlert({ ...alert, open: false });
  };

  const formatRelativeTime = (timestamp: string | null) => {
    if (!timestamp) {
      return 'No activity yet';
    }
    const target = new Date(timestamp).getTime();
    if (Number.isNaN(target)) {
      return 'No activity yet';
    }
    const diff = Date.now() - target;
    if (diff < 0) {
      return 'In a moment';
    }
    const units = [
      { label: 'd', value: 1000 * 60 * 60 * 24 },
      { label: 'h', value: 1000 * 60 * 60 },
      { label: 'm', value: 1000 * 60 },
      { label: 's', value: 1000 },
    ];
    for (const unit of units) {
      const count = Math.floor(diff / unit.value);
      if (count >= 1) {
        return `${count}${unit.label} ago`;
      }
    }
    return 'Just now';
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) {
      return '—';
    }
    const totalSeconds = Math.round(ms / 1000);
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60) {
      return `${minutes}m${seconds ? ` ${seconds}s` : ''}`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h${remainingMinutes ? ` ${remainingMinutes}m` : ''}`;
  };

  const formatMessageTime = (timestamp: string | undefined) => {
    if (!timestamp) {
      console.warn('No timestamp provided for message');
      return 'Now';
    }
    
    try {
      // Handle different timestamp formats
      let date: Date;
      
      if (typeof timestamp === 'number') {
        date = new Date(timestamp);
      } else if (typeof timestamp === 'string') {
        // Try parsing as ISO string first, then as regular date string
        date = new Date(timestamp);
        
        // If invalid, try parsing as timestamp number
        if (isNaN(date.getTime()) && !isNaN(Number(timestamp))) {
          date = new Date(Number(timestamp));
        }
      } else {
        console.warn('Invalid timestamp type:', typeof timestamp, timestamp);
        return 'Now';
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date created from timestamp:', timestamp);
        return 'Now';
      }
      
      const now = new Date();
      
      // If message is from today, show time only
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
      
      // If message is from yesterday
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday ${date.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        })}`;
      }
      
      // If message is older, show date and time
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
    } catch (error) {
      console.error('Error formatting message time:', error, 'Timestamp:', timestamp);
      return 'Now';
    }
  };

  return (
    <Layout>
      <Typography variant="h4" component="h1" gutterBottom>
        Messages
      </Typography>
      
      <Box
        sx={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: '1fr 2fr',
            lg: '300px 1fr'
          },
          gap: 2,
          height: 'calc(100vh - 180px)',
          backgroundImage: 'linear-gradient(180deg, rgba(99,102,241,0.05), rgba(15,23,42,0.02))',
          borderRadius: 4,
          padding: 1,
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at top left, rgba(14,165,233,0.2), transparent 45%)',
            zIndex: 0,
            borderRadius: 32,
            pointerEvents: 'none'
          },
          '& > *': {
            position: 'relative',
            zIndex: 1
          }
        }}
      >
        {/* Users List */}
        <Paper 
          elevation={3} 
          sx={{ 
            height: '100%', 
            borderRadius: 3,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(236,72,153,0.08))',
            border: '1px solid rgba(99, 102, 241, 0.15)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.4)', background: 'rgba(15, 23, 42, 0.15)' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {user?.is_admin ? 'All Users' : 'Friends'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {contactSearch ? `Filtering ${filteredUsers.length} contact(s)` : `${users.length} contact(s) available`}
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by name or username"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
            />
          </Box>
          <List sx={{ flexGrow: 1, overflow: 'auto' }}>
            {users.length === 0 ? (
              <ListItem>
                <ListItemText 
                  primary="No friends yet" 
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Add friends to start chatting
                      </Typography>
                      <Button 
                        size="small" 
                        variant="outlined" 
                        sx={{ mt: 1 }}
                        onClick={() => window.location.href = '/friends'}
                      >
                        Add Friends
                      </Button>
                    </Box>
                  }
                />
              </ListItem>
            ) : filteredUsers.length === 0 ? (
              <ListItem>
                <ListItemText
                  primary="No contacts match your search"
                  secondary={`Try refining "${contactSearch || 'your search'}"`}
                />
              </ListItem>
            ) : (
              filteredUsers.map((u) => (
                <React.Fragment key={u.id}>
                  <ListItemButton
                    selected={selectedUser?.id === u.id}
                    onClick={() => handleUserSelect(u)}
                    sx={{
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(99, 102, 241, 0.18)',
                        backdropFilter: 'blur(6px)',
                        color: 'primary.contrastText'
                      },
                      '&:hover': {
                        backgroundColor: 'rgba(99, 102, 241, 0.12)',
                      },
                    }}
                  >
                    <ListItemAvatar>
                      <Badge 
                        badgeContent={unreadCounts[u.id] || 0} 
                        color="error"
                        invisible={!unreadCounts[u.id]}
                      >
                        <Avatar sx={{ bgcolor: selectedUser?.id === u.id ? 'primary.main' : 'grey.400' }}>
                          {u.username.charAt(0).toUpperCase()}
                        </Avatar>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText 
                      primary={u.full_name} 
                      secondary={u.username}
                      primaryTypographyProps={{
                        fontWeight: selectedUser?.id === u.id || unreadCounts[u.id] ? 'bold' : 'normal',
                      }}
                    />
                    {unreadCounts[u.id] > 0 && (
                      <NotificationIcon sx={{ color: 'primary.main', ml: 1 }} />
                    )}
                  </ListItemButton>
                  <Divider variant="inset" component="li" />
                </React.Fragment>
              ))
            )}
          </List>
        </Paper>
        
        {/* Chat Area */}
        <Paper 
          elevation={4} 
          sx={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            borderRadius: 3,
            overflow: 'hidden',
            background: 'linear-gradient(145deg, rgba(255,255,255,0.95), rgba(248,250,252,0.85))',
            border: '1px solid rgba(15, 23, 42, 0.05)',
            boxShadow: '0px 20px 45px -30px rgba(15, 23, 42, 0.8)'
          }}
        >
          {selectedUser ? (
            <>
              {/* Chat Header */}
              <Box sx={{ p: 2, borderBottom: '1px solid rgba(0, 0, 0, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    {selectedUser.username.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{selectedUser.full_name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      @{selectedUser.username}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    icon={<OnlineIcon sx={{ fontSize: '12px !important' }} />}
                    label={connectionStatus}
                    size="small"
                    color={connectionStatus === 'connected' ? 'success' : connectionStatus === 'connecting' ? 'warning' : 'error'}
                    variant="outlined"
                  />
                  {connectionStatus === 'disconnected' && (
                    <IconButton
                      size="small"
                      onClick={connectWebSocket}
                      title="Reconnect"
                    >
                      <RefreshIcon />
                    </IconButton>
                  )}
                </Box>
              </Box>
              
            {/* Conversation Insights */}
            <Box
              sx={{
                px: 2,
                py: 2,
                borderBottom: '1px solid rgba(99, 102, 241, 0.15)',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(248,250,252,0.9))'
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                Conversation insights
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                  gap: 2
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(14,165,233,0.12))',
                    color: '#0f172a'
                  }}
                >
                  <Typography variant="caption" sx={{ letterSpacing: 1, textTransform: 'uppercase' }}>
                    Conversation Pulse
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 1, mb: 0.5 }}>
                    {conversationStats.totalMessages}
                  </Typography>
                  <Typography variant="body2" color="rgba(15, 23, 42, 0.8)">
                    {conversationStats.totalMessages ? `Last ping ${formatRelativeTime(conversationStats.lastMessageTime)}` : 'Start a new conversation'}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, rgba(244,63,94,0.15), rgba(249,115,22,0.12))'
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ letterSpacing: 1, textTransform: 'uppercase' }}>
                      Safety Monitor
                    </Typography>
                    <Chip
                      size="small"
                      color={conversationStats.abusiveCount === 0 ? 'success' : 'warning'}
                      label={conversationStats.abusiveCount === 0 ? 'Clean' : 'Review'}
                    />
                  </Box>
                  <Typography variant="h4" sx={{ mt: 1, mb: 0.5 }}>
                    {conversationStats.abusiveCount}
                  </Typography>
                  <Tooltip title={`${conversationStats.abusePercentage.toFixed(1)}% of conversation flagged`}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, conversationStats.abusePercentage)}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: 'rgba(255, 255, 255, 0.4)',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4
                        }
                      }}
                    />
                  </Tooltip>
                </Box>

                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(129,140,248,0.12))'
                  }}
                >
                  <Typography variant="caption" sx={{ letterSpacing: 1, textTransform: 'uppercase' }}>
                    Response Tempo
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 1, mb: 0.5 }}>
                    {formatDuration(conversationStats.averageResponseMs)}
                  </Typography>
                  <Typography variant="body2" color="rgba(15, 23, 42, 0.8)">
                    Average time between replies
                  </Typography>
                </Box>
              </Box>
            </Box>
            
              {/* Messages */}
              <Box sx={{ 
                flexGrow: 1, 
                overflow: 'auto', 
                p: 2,
                display: 'flex',
                flexDirection: 'column'
              }}>
                {messages.length === 0 ? (
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    height: '100%'
                  }}>
                    <Typography color="text.secondary">
                      No messages yet. Start a conversation!
                    </Typography>
                  </Box>
                ) : (
                  messages.map((message) => {
                    const isCurrentUser = message.sender_id === user?.id;
                    return (
                      <Box
                        key={message.id}
                        sx={{
                          display: 'flex',
                          justifyContent: isCurrentUser ? 'flex-end' : 'flex-start',
                          mb: 2,
                        }}
                      >
                        {!isCurrentUser && (
                          <Avatar sx={{ mr: 1, bgcolor: 'grey.400' }}>
                            {selectedUser.username.charAt(0).toUpperCase()}
                          </Avatar>
                        )}
                        <Paper
                          elevation={1}
                          sx={{
                            p: 2,
                            maxWidth: '70%',
                            borderRadius: 2,
                            backgroundColor: isCurrentUser 
                              ? (message.is_abusive ? 'error.main' : 'primary.main')
                              : (message.is_abusive ? 'error.light' : 'grey.100'),
                            color: isCurrentUser ? 'white' : 'text.primary',
                            border: message.is_abusive ? '2px solid' : 'none',
                            borderColor: message.is_abusive ? 'error.dark' : 'transparent',
                          }}
                        >
                          {message.is_abusive && (
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                display: 'block', 
                                mb: 1,
                                color: isCurrentUser ? 'rgba(255, 255, 255, 0.9)' : 'error.dark',
                                fontWeight: 'bold',
                                textTransform: 'uppercase'
                              }}
                            >
                              ⚠️ ABUSIVE CONTENT DETECTED
                            </Typography>
                          )}
                          
                          <Typography 
                            variant="body1" 
                            sx={{ 
                              wordBreak: 'break-word',
                              filter: message.is_abusive ? 'blur(4px)' : 'none',
                              transition: 'filter 0.3s ease',
                              cursor: message.is_abusive ? 'pointer' : 'default',
                              '&:hover': {
                                filter: message.is_abusive ? 'blur(0px)' : 'none'
                              }
                            }}
                            title={message.is_abusive ? 'Hover to reveal content' : ''}
                          >
                            {message.content}
                          </Typography>
                          
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              display: 'block', 
                              mt: 1, 
                              opacity: 0.7,
                              color: isCurrentUser ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary'
                            }}
                          >
                            {formatMessageTime(message.created_at)}
                          </Typography>
                        </Paper>
                      </Box>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </Box>
              
              {/* Message Input */}
              <Box sx={{ p: 2, borderTop: '1px solid rgba(0, 0, 0, 0.12)', display: 'flex' }}>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  size="small"
                  multiline
                  maxRows={4}
                  sx={{ mr: 1 }}
                />
                <IconButton 
                  color="primary" 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  sx={{ 
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                    '&.Mui-disabled': {
                      bgcolor: 'action.disabledBackground',
                    }
                  }}
                >
                  <SendIcon />
                </IconButton>
              </Box>
            </>
          ) : (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'center', 
              alignItems: 'center',
              height: '100%',
              p: 3
            }}>
              <PersonIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Select a contact to start chatting
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
      
      <Snackbar 
        open={alert.open} 
        autoHideDuration={6000} 
        onClose={handleCloseAlert}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseAlert} severity={alert.type} sx={{ width: '100%' }}>
          {alert.message}
        </Alert>
      </Snackbar>
    </Layout>
  );
};

export default Chat;