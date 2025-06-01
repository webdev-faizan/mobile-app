import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Modal,
  Platform,
  KeyboardAvoidingView,
  FlatList,
  useColorScheme,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { MarkdownView } from "react-native-markdown-view";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import { Dimensions } from "react-native";
const { width } = Dimensions.get("window");
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const ChatApp = () => {
  const colorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(colorScheme === "dark");
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [chatHistory, setChatHistory] = useState({});
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(null);
  const [showProfileOptions, setShowProfileOptions] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.navigate("Login");
  };

  // Theme colors
  const colors = {
    light: {
      primary: "#7c4dff",
      secondary: "#b388ff",
      textPrimary: "#333",
      textSecondary: "#666",
      backgroundPrimary: "#fff",
      backgroundSecondary: "#f5f7fb",
      backgroundTertiary: "#edf0f7",
      aiMessageBg: "#f0f4ff",
      userMessageBg: "#7c4dff",
      userMessageText: "#fff",
      borderColor: "#e0e0e0",
      shadowColor: "rgba(0, 0, 0, 0.1)",
    },
    dark: {
      primary: "#9d74ff",
      secondary: "#b388ff",
      textPrimary: "#e0e0e0",
      textSecondary: "#aaaaaa",
      backgroundPrimary: "#1a1a1a",
      backgroundSecondary: "#252525",
      backgroundTertiary: "#333333",
      aiMessageBg: "#2d2d3d",
      userMessageBg: "#9d74ff",
      userMessageText: "#fff",
      borderColor: "#444",
      shadowColor: "rgba(0, 0, 0, 0.6)",
    },
  };

  const theme = isDarkMode ? colors.dark : colors.light;
  const isMobile = width <= 767;

  useEffect(() => {
    setIsSidebarCollapsed(isMobile);
  }, [isMobile]);
  // Initialize the app
  useEffect(() => {
    const initApp = async () => {
      try {
        // Load chat history from AsyncStorage
        const savedHistory = await AsyncStorage.getItem("chatHistory");
        const savedTheme = await AsyncStorage.getItem("theme");

        if (savedTheme) {
          setIsDarkMode(savedTheme === "dark");
        }

        if (savedHistory) {
          const parsedHistory = JSON.parse(savedHistory);
          setChatHistory(parsedHistory);

          // Load most recent chat or create new one
          if (Object.keys(parsedHistory).length > 0) {
            const mostRecentChatId = Object.keys(parsedHistory).sort((a, b) => {
              return parsedHistory[b].timestamp - parsedHistory[a].timestamp;
            })[0];
            loadChat(mostRecentChatId);
          } else {
            createNewChat();
          }
        } else {
          createNewChat();
        }
      } catch (error) {
        console.error("Error initializing app:", error);
      }
    };

    initApp();
  }, []);

  // Save chat history when it changes
  useEffect(() => {
    const saveHistory = async () => {
      try {
        await AsyncStorage.setItem("chatHistory", JSON.stringify(chatHistory));
      } catch (error) {
        console.error("Error saving chat history:", error);
      }
    };

    if (Object.keys(chatHistory).length > 0) {
      saveHistory();
    }
  }, [chatHistory]);

  // Save theme preference when it changes
  useEffect(() => {
    const saveTheme = async () => {
      try {
        await AsyncStorage.setItem("theme", isDarkMode ? "dark" : "light");
      } catch (error) {
        console.error("Error saving theme:", error);
      }
    };

    saveTheme();
  }, [isDarkMode]);

  // Scroll to bottom when messages change
  //   useEffect(() => {
  //     if (messagesEndRef.current && messages.length > 0) {
  //       messagesEndRef.current.scrollToEnd({ animated: true });
  //     }
  //   }, [messages]);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);
  // Create a new chat
  const createNewChat = () => {
    const chatId = `chat_${Date.now()}`;
    const newChat = {
      id: chatId,
      title: "New Conversation",
      timestamp: Date.now(),
      messages: [],
    };

    setChatHistory((prev) => ({
      ...prev,
      [chatId]: newChat,
    }));

    setCurrentChatId(chatId);
    setMessages([]);
    setPendingFile(null);
    setShowFilePreview(false);
  };

  // Load a chat
  const loadChat = (chatId) => {
    if (!chatHistory[chatId]) return;

    setCurrentChatId(chatId);
    setMessages(chatHistory[chatId].messages);
    setPendingFile(null);
    setShowFilePreview(false);
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (isTyping) {
      Alert.alert(
        "Please wait",
        "Please wait until the current response is completed."
      );
      return;
    }

    const message = inputText.trim();
    if (!message && !pendingFile) return;

    // Create new chat if none exists
    if (!currentChatId || !chatHistory[currentChatId]) {
      createNewChat();
      return;
    }

    // Add user message
    const newUserMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: message,
      file: pendingFile
        ? {
            name: pendingFile.name,
            type: pendingFile.mimeType,
            uri: pendingFile.uri,
          }
        : null,
    };

    // Update messages and chat history
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setInputText("");

    const updatedChat = {
      ...chatHistory[currentChatId],
      messages: updatedMessages,
    };

    // Set chat title if it's the first message
    if (updatedChat.messages.length === 1) {
      const title =
        message.split(" ").slice(0, 4).join(" ") +
        (message.split(" ").length > 4 ? "..." : "");
      updatedChat.title = title;
    }

    setChatHistory((prev) => ({
      ...prev,
      [currentChatId]: updatedChat,
    }));

    // Clear pending file
    setPendingFile(null);
    setShowFilePreview(false);

    // Get AI response
    try {
      setIsTyping(true);
      const aiResponse = await getAIResponse(updatedChat);

      const newAiMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: aiResponse,
      };

      const finalMessages = [...updatedMessages, newAiMessage];
      setMessages(finalMessages);

      setChatHistory((prev) => ({
        ...prev,
        [currentChatId]: {
          ...updatedChat,
          messages: finalMessages,
        },
      }));
    } catch (error) {
      console.error("Error getting AI response:", error);
      Alert.alert(
        "Error",
        "Sorry, I encountered an error while generating a response."
      );
    } finally {
      setIsTyping(false);
    }
  };

  // Simulate AI response (replace with actual API call)
  const getAIResponse = async (chat) => {
    return new Promise((resolve) => {
      // Simulate API delay
      setTimeout(() => {
        const responses = [
          "I'm an AI assistant here to help you. How can I assist you today?",
          "That's an interesting question. Let me think about that...",
          "Here's what I found about your query.",
          "I can help with that. Here's some information that might be useful.",
        ];

        resolve(responses[Math.floor(Math.random() * responses.length)]);
      }, 1500);
    });
  };

  // Handle file upload
  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.type === "success") {
        setPendingFile(result);
        setShowFilePreview(true);
      }
    } catch (error) {
      console.error("Error picking file:", error);
    }
  };

  // Clear chat history
  const clearAllHistory = () => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to clear all chat history? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            setChatHistory({});
            createNewChat();
          },
        },
      ]
    );
  };

  // Toggle theme
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Export current chat
  const exportCurrentChat = async () => {
    if (!currentChatId || !chatHistory[currentChatId]) return;

    const chat = chatHistory[currentChatId];
    let exportText = `# ${chat.title}\n\n`;

    chat.messages.forEach((message) => {
      const role = message.role === "user" ? "You" : "AI";
      exportText += `## ${role}:\n${message.content}\n\n`;
    });

    try {
      const fileUri = `${FileSystem.documentDirectory}${chat.title.replace(
        /[^\w\s]/gi,
        ""
      )}.md`;
      await FileSystem.writeAsStringAsync(fileUri, exportText);
      await Sharing.shareAsync(fileUri);
    } catch (error) {
      console.error("Error exporting chat:", error);
      Alert.alert("Error", "Failed to export chat.");
    }
  };

  // Delete a chat
  const deleteChat = (chatId) => {
    Alert.alert("Delete Chat", "Are you sure you want to delete this chat?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const updatedHistory = { ...chatHistory };
          delete updatedHistory[chatId];
          setChatHistory(updatedHistory);

          if (currentChatId === chatId) {
            createNewChat();
          }
        },
      },
    ]);
  };

  // Rename a chat
  // Replace the current renameChat function with this:
  const renameChat = (chatId) => {
    if (Platform.OS === "web") {
      // Web implementation using window.prompt
      const newName = window.prompt("Rename Chat", chatHistory[chatId].title);

      if (newName && newName.trim()) {
        setChatHistory((prev) => ({
          ...prev,
          [chatId]: {
            ...prev[chatId],
            title: newName.trim(),
          },
        }));
      }
    } else {
      // Native implementation using Alert.prompt
      Alert.prompt(
        "Rename Chat",
        "Enter new name for this chat:",
        (newName) => {
          if (newName && newName.trim()) {
            setChatHistory((prev) => ({
              ...prev,
              [chatId]: {
                ...prev[chatId],
                title: newName.trim(),
              },
            }));
          }
        },
        "plain-text",
        chatHistory[chatId].title
      );
    }
  };

  // Render message item
  const renderMessage = ({ item }) => {
    const isUser = item.role === "user";

    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.aiMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageContent,
            isUser
              ? { backgroundColor: theme.userMessageBg }
              : { backgroundColor: theme.aiMessageBg },
          ]}
        >
          {item.file && (
            <View style={styles.filePreview}>
              {item.file.type.startsWith("image/") ? (
                <Image
                  source={{ uri: item.file.uri }}
                  style={styles.fileImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.fileName}>{item.file.name}</Text>
              )}
            </View>
          )}
          {item.content && (
            <MarkdownView
              styles={{
                text: {
                  color: isUser ? theme.userMessageText : theme.textPrimary,
                },
              }}
            >
              {item.content}
            </MarkdownView>
          )}
        </View>
      </View>
    );
  };

  // Render chat history item
  const renderChatHistoryItem = ({ item }) => {
    const chat = chatHistory[item];

    return (
      <TouchableOpacity
        style={[
          styles.chatHistoryItem,
          currentChatId === item && styles.activeChatHistoryItem,
        ]}
        onPress={() => loadChat(item)}
      >
        <Icon
          name="comment"
          size={16}
          color={currentChatId === item ? theme.primary : theme.textSecondary}
          style={styles.chatHistoryIcon}
        />
        <Text
          style={[
            styles.chatHistoryText,
            {
              color: currentChatId === item ? theme.primary : theme.textPrimary,
            },
          ]}
          numberOfLines={1}
        >
          {chat.title}
        </Text>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            setShowChatOptions(showChatOptions === item ? null : item);
          }}
          style={styles.chatOptionsButton}
        >
          <Icon name="ellipsis-v" size={16} color={theme.textSecondary} />
        </TouchableOpacity>

        {showChatOptions === item && (
          <View
            style={[
              styles.chatOptionsMenu,
              { backgroundColor: theme.backgroundPrimary },
            ]}
          >
            <TouchableOpacity
              style={styles.chatOptionsItem}
              onPress={() => {
                renameChat(item);
                setShowChatOptions(null);
              }}
            >
              <Text style={{ color: theme.textPrimary }}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.chatOptionsItem}
              onPress={() => {
                deleteChat(item);
                setShowChatOptions(null);
              }}
            >
              <Text style={{ color: "red" }}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [currentRenameChatId, setCurrentRenameChatId] = useState(null);
  const [newChatName, setNewChatName] = useState("");

  const handleRenameConfirm = () => {
    if (newChatName && newChatName.trim()) {
      setChatHistory((prev) => ({
        ...prev,
        [currentRenameChatId]: {
          ...prev[currentRenameChatId],
          title: newChatName.trim(),
        },
      }));
    }
    setRenameModalVisible(false);
  };

  // Add this effect to close profile options when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showProfileOptions) {
        setShowProfileOptions(false);
      }
    };

    // For web
    if (Platform.OS === "web") {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showProfileOptions]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundSecondary,
          padding: isMobile ? 10 : 20,
        },
      ]}
    >
      <Modal
        visible={renameModalVisible}
        transparent={true}
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.backgroundPrimary },
          ]}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Rename Chat
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: theme.textPrimary,
                  borderColor: "transparent",
                  outlineStyle: "none", // Removes focus outline (Chrome, Firefox, Safari)
                  outlineWidth: 0, // Fallback for older browsers
                  outline: "none",
                  ...Platform.select({
                    ios: { outlineStyle: "none" },
                    android: { outline: "none" },
                  }),
                },
              ]}
              value={newChatName}
              onChangeText={setNewChatName}
              placeholder="Enter new chat name"
              placeholderTextColor={theme.textSecondary}
              autoFocus
              underlineColorAndroid="transparent"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setRenameModalVisible(false)}
              >
                <Text style={{ color: theme.textPrimary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={handleRenameConfirm}
              >
                <Text style={{ color: "#fff" }}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <View
        style={[
          styles.appContainer,
          { backgroundColor: theme.backgroundPrimary },
        ]}
      >
        <View
          style={[
            styles.sidebar,
            isMobile && !isSidebarCollapsed && styles.mobileSidebar,
            {
              backgroundColor: theme.backgroundTertiary,
              width: isSidebarCollapsed ? 0 : 260,
              display: isSidebarCollapsed ? "none" : "flex",
              position: isMobile ? "absolute" : "relative",
              height: "100%",
              zIndex: 9999,
            },
          ]}
        >
          <View
            style={[
              styles.logo,
              {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              },
            ]}
          >
            <Text
              style={[
                styles.logoText,
                { color: theme.primary, textAlign: "center" },
              ]}
            >
              SDS
            </Text>
            {isMobile && !isSidebarCollapsed && (
              <TouchableOpacity
                onPress={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                style={styles.sidebarToggle}
              >
                <Icon
                  name={isSidebarCollapsed ? "chevron-right" : "chevron-left"}
                  size={18}
                  color={theme.textPrimary}
                />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.newChatButton, { backgroundColor: theme.primary }]}
            onPress={createNewChat}
          >
            <Icon name="plus" size={16} color="#fff" />
            <Text style={styles.newChatButtonText}>New Chat</Text>
          </TouchableOpacity>

          <View
            style={[
              styles.historyContainer,
              {
                position: "relative",
                zIndex: 1,
              },
            ]}
          >
            <Text style={[styles.historyTitle, { color: theme.textSecondary }]}>
              Chat History
            </Text>
            <FlatList
              data={Object.keys(chatHistory).sort((a, b) => {
                return chatHistory[b].timestamp - chatHistory[a].timestamp;
              })}
              renderItem={renderChatHistoryItem}
              keyExtractor={(item) => item}
              style={styles.chatHistoryList}
            />
          </View>

          <View
            style={[styles.settings, { borderTopColor: theme.borderColor }]}
          >
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => setShowProfileOptions(!showProfileOptions)}
            >
              <View style={styles.profileIcon}>
                <Icon name="user" size={16} color="#fff" />
              </View>
              <Text
                style={[
                  styles.settingsButtonText,
                  { color: theme.textPrimary, marginLeft: 10 },
                ]}
              >
                User Profile
              </Text>
            </TouchableOpacity>

            {showProfileOptions && (
              <View
                style={[
                  styles.profileOptions,
                  {
                    backgroundColor: theme.backgroundPrimary,
                    borderColor: theme.borderColor,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.profileOptionItem}
                  onPress={() => {
                    setShowProfileOptions(false);
                    // Add settings navigation here
                  }}
                >
                  <View style={styles.profileOptionIcon}>
                    <Icon name="cog" size={14} color={theme.primary} />
                  </View>
                  <Text
                    style={[
                      styles.profileOptionText,
                      { color: theme.textPrimary },
                    ]}
                  >
                    Settings
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={clearAllHistory}
                >
                  <Icon name="trash" size={16} color={theme.textSecondary} />
                  <Text
                    style={[
                      styles.settingsButtonText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Clear History
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={toggleTheme}
                >
                  <Icon
                    name={isDarkMode ? "sun" : "moon"}
                    size={16}
                    color={theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.settingsButtonText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {isDarkMode ? "Light Mode" : "Dark Mode"}
                  </Text>
                </TouchableOpacity>

                <View
                  style={[
                    styles.divider,
                    { backgroundColor: theme.borderColor },
                  ]}
                />

                <TouchableOpacity style={styles.profileOptionItem}>
                  <View style={styles.profileOptionIcon}>
                    <Icon name="sign-out" size={14} color="#ff4444" />
                  </View>
                  <Text
                    onPress={handleLogout}
                    style={[styles.profileOptionText, { color: "#ff4444" }]}
                  >
                    Logout
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Chat Container */}
        <View style={styles.chatContainer}>
          {/* Chat Header */}
          <View
            style={[
              styles.chatHeader,

              { borderBottomColor: theme.borderColor },
            ]}
          >
            <TouchableOpacity
              onPress={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              style={styles.sidebarToggle}
            >
              <Icon
                name={isSidebarCollapsed ? "chevron-right" : "chevron-left"}
                size={18}
                color={theme.textPrimary}
              />
            </TouchableOpacity>
            <Text
              style={[styles.currentChatTitle, { color: theme.textPrimary }]}
            >
              {currentChatId && chatHistory[currentChatId]
                ? chatHistory[currentChatId].title
                : "New Conversation"}
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => {
                  // Implement regenerate response
                }}
                disabled={isTyping}
              >
                <Icon
                  name="sync"
                  size={18}
                  color={isTyping ? theme.textSecondary : theme.textPrimary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={exportCurrentChat}
                style={styles.headerActionButton}
              >
                <Icon name="download" size={18} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Messages */}
          {messages.length === 0 ? (
            <View style={styles.introMessage}>
              <Text style={[styles.introTitle, { color: theme.primary }]}>
                Welcome to SuperiorDataScience AI
              </Text>
              <Text style={[styles.introText, { color: theme.textSecondary }]}>
                Ask me anything. I'm powered by deepseek-r1.
              </Text>
              <View style={styles.suggestionChips}>
                {[
                  "Tell me a story",
                  "Explain quantum computing",
                  "Write a poem",
                  "Help me learn JavaScript",
                ].map((text) => (
                  <TouchableOpacity
                    key={text}
                    style={[
                      styles.suggestionChip,
                      {
                        backgroundColor: theme.backgroundTertiary,
                        borderColor: theme.borderColor,
                      },
                    ]}
                    onPress={() => {
                      setInputText(text);
                      setTimeout(() => {
                        handleSendMessage();
                      }, 100);
                    }}
                  >
                    <Text style={{ color: theme.textPrimary }}>{text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesContainer}
            />
          )}

          {isTyping && (
            <View style={styles.typingIndicator}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.typingDot,
                    { backgroundColor: theme.primary },
                    { opacity: 0.6 + i * 0.1 },
                  ]}
                />
              ))}
            </View>
          )}

          {/* Input Area */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={[styles.inputArea, { borderTopColor: theme.borderColor }]}
          >
            {showFilePreview && pendingFile && (
              <View style={styles.pendingFilePreview}>
                {pendingFile.mimeType.startsWith("image/") ? (
                  <Image
                    source={{ uri: pendingFile.uri }}
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Text
                    style={[styles.previewText, { color: theme.textPrimary }]}
                  >
                    {pendingFile.name}
                  </Text>
                )}
                <TouchableOpacity
                  onPress={() => {
                    setPendingFile(null);
                    setShowFilePreview(false);
                  }}
                  style={styles.removeFileButton}
                >
                  <Icon name="times" size={16} color="red" />
                </TouchableOpacity>
              </View>
            )}

            <View
              style={[
                styles.inputContainer,
                { backgroundColor: theme.backgroundTertiary },
              ]}
            >
              <TouchableOpacity onPress={handleFileUpload}>
                <Icon
                  name="paperclip"
                  size={20}
                  color={theme.textSecondary}
                  style={styles.fileUploadButton}
                />
              </TouchableOpacity>

              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: theme.textPrimary,
                    backgroundColor: theme.backgroundTertiary,
                  },
                ]}
                placeholder="Type your message here..."
                placeholderTextColor={theme.textSecondary}
                value={inputText}
                onChangeText={setInputText}
                multiline
                onSubmitEditing={() => {
                  if (!inputText.trim()) return;
                  handleSendMessage();
                }}
              />

              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: theme.primary }]}
                onPress={handleSendMessage}
                disabled={!inputText.trim() && !pendingFile}
              >
                <Icon name="paper-plane" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={[styles.disclaimer, { color: theme.textSecondary }]}>
              SuperiorDataScienceChatBot may produce inaccurate information.
              Messages are stored locally.
            </Text>
          </KeyboardAvoidingView>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // padding: 20,
  },
  appContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    flexDirection: "row",
  },
  sidebar: {
    width: 260,
    padding: 20,
    flexDirection: "column",
  },
  logo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  logoText: {
    fontSize: 22,
    fontWeight: "bold",
    marginLeft: 10,
  },
  newChatButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  newChatButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  historyContainer: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 14,
    marginBottom: 10,
    paddingLeft: 5,
  },
  chatHistoryList: {
    flex: 1,
  },

  chatHistoryItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    marginBottom: 5,
    position: "relative", // Add this
    zIndex: 1, // Add this
    elevation: 1,
  },
  activeChatHistoryItem: {
    backgroundColor: "rgba(124, 77, 255, 0.1)",
  },
  chatHistoryIcon: {
    marginRight: 10,
  },
  chatHistoryText: {
    flex: 1,
    fontSize: 14,
  },
  chatOptionsButton: {
    padding: 5,
  },
  chatOptionsMenu: {
    position: "absolute",
    right: 10,
    top: 40,
    borderRadius: 8,
    padding: 5,
    zIndex: 9999,
    elevation: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    minWidth: 120, // Ensure minimum width
  },
  chatOptionsItem: {
    padding: 8,
  },
  settings: {
    marginTop: 20,
    paddingTop: 15,
  },
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
  },
  settingsButtonText: {
    fontSize: 14,
    marginLeft: 10,
  },
  chatContainer: {
    flex: 1,
    flexDirection: "column",
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
  },
  currentChatTitle: {
    fontWeight: "600",
    fontSize: 16,
  },
  headerActions: {
    flexDirection: "row",
  },
  headerActionButton: {
    marginLeft: 15,
  },
  messagesContainer: {
    padding: 20,
  },
  messageContainer: {
    marginVertical: 10,
  },
  userMessageContainer: {
    alignItems: "flex-end",
  },
  aiMessageContainer: {
    alignItems: "flex-start",
  },
  messageContent: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 12,
  },
  introMessage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  introTitle: {
    fontSize: 28,
    marginBottom: 15,
  },
  introText: {
    fontSize: 16,
    marginBottom: 25,
  },
  suggestionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  suggestionChip: {
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
  },
  typingIndicator: {
    flexDirection: "row",
    padding: 15,
    justifyContent: "center",
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  inputArea: {
    padding: 15,
    borderTopWidth: 0,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    overflow: "hidden",
  },
  fileUploadButton: {
    padding: 15,
  },
  textInput: {
    flex: 1,
    padding: 15,
    fontSize: 15,
    maxHeight: 150,
  },
  sendButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  disclaimer: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
  },
  pendingFilePreview: {
    marginBottom: 10,
    position: "relative",
  },
  previewImage: {
    width: 100,
    height: 100,
  },
  previewText: {
    fontSize: 12,
  },
  removeFileButton: {
    position: "absolute",
    right: 0,
    top: 0,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: 10,
    padding: 2,
  },
  filePreview: {
    marginBottom: 10,
  },
  fileImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
  },
  fileName: {
    fontSize: 14,
    color: "#666",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    width: "80%",
    padding: 20,
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  modalButton: {
    padding: 10,
    marginLeft: 10,
    borderRadius: 5,
  },

  profileIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#7c4dff",
    justifyContent: "center",
    alignItems: "center",
  },
  sidebarToggle: {
    padding: 5,
    marginRight: 10,
  },
  //
  profileOptions: {
    position: "absolute",
    bottom: 60,
    left: 20,
    right: 20,
    borderRadius: 8,
    paddingVertical: 5,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 100,
  },
  profileOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  profileOptionIcon: {
    width: 20,
    alignItems: "center",
    marginRight: 10,
  },
  profileOptionText: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginVertical: 2,
  },
  profileButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
});
