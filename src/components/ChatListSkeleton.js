import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import './Chat.css'; // Assuming Chat.css has styles for chat-item

const ChatListSkeleton = () => {
  return (
    <div className="chat-list-items">
      {Array(5)
        .fill(0)
        .map((_, i) => (
          <div className="chat-item" key={i}>
            <Skeleton circle={true} height={50} width={50} />
            <div className="chat-item-content" style={{ flex: 1, marginLeft: '15px' }}>
              <div className="chat-item-header">
                <span className="chat-name" style={{ flex: 1 }}>
                  <Skeleton width={`60%`} />
                </span>
                <span className="chat-time">
                  <Skeleton width={50} />
                </span>
              </div>
              <div className="chat-item-footer">
                <p className="chat-last-message">
                  <Skeleton width={`80%`} />
                </p>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
};

export default ChatListSkeleton;
