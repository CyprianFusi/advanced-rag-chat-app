import React, {useState} from 'react';
import './App.css';
import {fetchEventSource} from "@microsoft/fetch-event-source";

interface Message {
  message: string;
  isUser: boolean;
  sources?: string[];
}

function App() {
  const [inputValue, setInputValue] = useState("")
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const setPartialMessage = (chunk: string, sources: string[] = []) => {
    setMessages(prevMessages => {
      let lastMessage = prevMessages[prevMessages.length - 1];
      if (prevMessages.length === 0 || !lastMessage.isUser) {
        return [...prevMessages.slice(0, -1), {
          message: lastMessage.message + chunk,
          isUser: false,
          sources: lastMessage.sources ? [...lastMessage.sources, ...sources] : sources
        }];
      }

      return [...prevMessages, {message: chunk, isUser: false, sources}];
    })
  }

  function handleReceiveMessage(data: string) {
    let parsedData = JSON.parse(data);

    if (parsedData.answer) {
      setPartialMessage(parsedData.answer.content)
    }

    if (parsedData.docs) {
      setPartialMessage("", parsedData.docs.map((doc: any) => doc.metadata.source))
    }
  }

  const handleSendMessage = async (message: string) => {
    setInputValue("")

    setMessages(prevMessages => [...prevMessages, {message, isUser: true}]);

    await fetchEventSource(`http://localhost:8000/rag/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          question: message,
        }
      }),
      onmessage(event) {
        if (event.event === "data") {
          handleReceiveMessage(event.data);
        }
      },
    })
  }

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      handleSendMessage(inputValue.trim())
    }
  }

  function formatSource(source: string) {
    return source.split("\\").pop() || "";
  }

  const handleUploadFiles = async () => {
    if (!selectedFiles) {
      return;
    }
  
    const formData = new FormData();
    Array.from(selectedFiles).forEach((file: Blob) => {
      formData.append('files', file);
    });
  
    // Example: Sending files to a backend endpoint
    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData, // No headers for multipart/form-data; fetch adds it automatically
      });
      
      if (response.ok) {
        console.log('Upload successful');
      } else {
        console.error('Upload failed');
      }
    } catch (error) {
      console.error('Error uploading files:', error);
    }
  };

  const loadAndProcessPDFs = async () => {
    try {
      const response = await fetch('http://localhost:8000/load-and-process-pdfs', {
        method: 'POST',
      });
      if (response.ok) {
        console.log('PDFs loaded and processed successfully');
      } else {
        console.error('Failed to load and process PDFs');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-blue-100 text-gray-800 text-center p-4 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-blue-700">Advanced Multi-Files RAG Chat App</h1>
      </header>
      <main className="flex-grow container mx-auto p-4 flex-col">
        <div className="flex-grow bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="border-b border-gray-200 p-4">
            {messages.map((msg, index) => (
              <div key={index}
                  className={`p-3 my-3 rounded-lg text-gray-800 ml-auto ${msg.isUser ? "bg-blue-50" : "bg-gray-50"}`}>
                {msg.message}
                {/* Source */}
                    {!msg.isUser && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 border-opacity-30">
                            <span className="text-xs font-medium opacity-80">
                                Sources:
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {msg.sources.map((src, idx) => {
                                    const filename = src.split(/[\\/]/).pop() || "";
                                    return (
                                        <a
                                            key={idx}
                                            href={formatSource(src)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center text-xs px-2.5 py-1 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-all"
                                            title={src}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span className="truncate max-w-[100px]">
                                                {filename}
                                            </span>
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    )}
              </div>
            ))}
          </div>
          <div className="p-4 bg-gray-50">
            <textarea
              className="form-textarea w-full p-2 border rounded text-gray-800 bg-white border-gray-300 resize-none h-auto"
              placeholder="Enter your message here..."
              onKeyUp={handleKeyPress}
              onChange={(e) => setInputValue(e.target.value)}
              value={inputValue}
            ></textarea>
            <button
              className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              onClick={() => handleSendMessage(inputValue.trim())}
            >
              Send
            </button>
            {/* Reordered elements */}
            <div className="mt-2">
              <input 
                type="file" 
                accept=".pdf" 
                multiple 
                onChange={(e) => setSelectedFiles(e.target.files)} 
              />
              <button
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded block"
                onClick={handleUploadFiles}
              >
                Upload PDFs
              </button>
              <button
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                onClick={loadAndProcessPDFs}
              >
                Load and Process PDFs
              </button>
            </div>
          </div>
        </div>
  
      </main>
          <footer className="bg-blue-100 text-gray-800 text-center p-4 text-xs border-t border-gray-200">
              &#169; Binati AInalytics, {new Date().getFullYear()}
          </footer>
  
    </div>
  );
  
}

export default App;
