import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Authenticated, useConvexAuth } from 'convex/react';
import { SignInForm } from './SignInForm';

interface Board {
  _id: Id<"boards">;
  name: string;
  description?: string;
  createdAt: number;
  createdBy: string;
}

interface Message {
  _id: Id<"messages">;
  content: string;
  author: string;
  boardId: Id<"boards">;
  createdAt: number;
}

interface NewBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBoard: (name: string, description: string) => void;
}

const NewBoardModal: React.FC<NewBoardModalProps> = ({ isOpen, onClose, onCreateBoard }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreateBoard(name.trim(), description.trim());
      setName('');
      setDescription('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 max-w-md w-full shadow-2xl border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Create New Board</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Board Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="Enter board name..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
              placeholder="Describe what this board is about..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-white bg-pink-500 hover:bg-pink-600 rounded-lg transition-colors"
            >
              Create Board
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Chatroom: React.FC = () => {
  const { isAuthenticated } = useConvexAuth();
  const [selectedBoard, setSelectedBoard] = useState<Id<"boards"> | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isNewBoardModalOpen, setIsNewBoardModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch boards and messages
  const boards = useQuery(api.boards.list) || [];
  const messages = useQuery(api.messages.list, selectedBoard ? { boardId: selectedBoard } : 'skip') || [];

  // Mutations
  const createBoard = useMutation(api.boards.create);
  const createDefaultBoards = useMutation(api.boards.createDefaultBoards);
  const sendMessage = useMutation(api.messages.send);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Create default boards if none exist
  useEffect(() => {
    if (boards.length === 0 && isAuthenticated) {
      createDefaultBoards();
    }
  }, [boards.length, isAuthenticated, createDefaultBoards]);

  // Select first board by default
  useEffect(() => {
    if (boards.length > 0 && !selectedBoard) {
      setSelectedBoard(boards[0]._id);
    }
  }, [boards, selectedBoard]);

  const handleCreateBoard = async (name: string, description: string) => {
    try {
      await createBoard({ name, description });
    } catch (error) {
      console.error('Failed to create board:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedBoard) return;

    try {
      await sendMessage({
        content: newMessage.trim(),
        boardId: selectedBoard
      });
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto glass-elevated glass-3d rounded-2xl border border-white/20 p-6 text-contrast">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">💬</span>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-4 text-contrast">Join the Chatroom</h1>
        <p className="text-center text-white/90 text-contrast-shadow mb-6">
          Sign in to join the conversation and connect with the community.
        </p>
        <SignInForm />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">💬 Community Chatroom</h1>
        <p className="text-gray-600">Connect, share, and create boards with the community</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Boards Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Boards</h2>
              <button
                onClick={() => setIsNewBoardModalOpen(true)}
                className="w-8 h-8 bg-pink-500 hover:bg-pink-600 text-white rounded-full flex items-center justify-center text-sm font-bold transition-colors"
                title="Create new board"
              >
                +
              </button>
            </div>

            <div className="space-y-2">
              {boards.map((board) => (
                <button
                  key={board._id}
                  onClick={() => setSelectedBoard(board._id)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    selectedBoard === board._id
                      ? 'bg-pink-100 border-2 border-pink-300 text-pink-900'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent text-gray-700 hover:border-gray-200'
                  }`}
                >
                  <div className="font-medium text-sm">{board.name}</div>
                  {board.description && (
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {board.description}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {boards.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📋</div>
                <p className="text-sm">No boards yet</p>
                <p className="text-xs mt-1">Create your first board to get started!</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-3">
          {selectedBoard ? (
            <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/20 h-[600px] flex flex-col">
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-pink-50 to-purple-50 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {boards.find(b => b._id === selectedBoard)?.name || 'Unknown Board'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {messages.length} message{messages.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500">
                    {boards.find(b => b._id === selectedBoard)?.description}
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-6xl mb-4">💭</div>
                    <h4 className="text-lg font-medium mb-2">Welcome to {boards.find(b => b._id === selectedBoard)?.name}!</h4>
                    <p className="text-sm">Be the first to start the conversation.</p>
                  </div>
                ) : (
                  <>
                    {/* Recent Posts Highlight */}
                    {messages.length > 3 && (
                      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-3 mb-4">
                        <div className="flex items-center gap-2 text-yellow-800 text-sm font-medium mb-2">
                          <span>⭐</span>
                          <span>Recent Activity</span>
                        </div>
                        <div className="space-y-2">
                          {messages.slice(-3).map((message) => (
                            <div key={message._id} className="text-xs text-yellow-700 truncate">
                              <span className="font-medium">{message.author}:</span> {message.content}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Messages */}
                    {messages.map((message, index) => {
                      const showDateSeparator = index === 0 ||
                        formatDate(messages[index - 1].createdAt) !== formatDate(message.createdAt);

                      return (
                        <div key={message._id}>
                          {showDateSeparator && (
                            <div className="flex items-center my-4">
                              <div className="flex-1 border-t border-gray-300"></div>
                              <div className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                                {formatDate(message.createdAt)}
                              </div>
                              <div className="flex-1 border-t border-gray-300"></div>
                            </div>
                          )}

                          <div className="flex gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                              {message.author.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-baseline gap-2 mb-1">
                                <span className="font-medium text-gray-900 text-sm">
                                  {message.author}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatTime(message.createdAt)}
                                </span>
                              </div>
                              <div className="text-gray-800 leading-relaxed">
                                {message.content}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
                <form onSubmit={handleSendMessage} className="flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    maxLength={500}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="px-6 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 text-white rounded-full font-medium transition-colors"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-md rounded-2xl p-12 text-center shadow-lg border border-white/20">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Board</h3>
              <p className="text-gray-600">Choose a board from the sidebar to start chatting!</p>
            </div>
          )}
        </div>
      </div>

      {/* New Board Modal */}
      <NewBoardModal
        isOpen={isNewBoardModalOpen}
        onClose={() => setIsNewBoardModalOpen(false)}
        onCreateBoard={handleCreateBoard}
      />
    </div>
  );
};

export default Chatroom;
