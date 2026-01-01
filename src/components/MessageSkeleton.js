import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import './Chat.css'; // Assuming Chat.css has styles for message bubbles

const MessageSkeleton = () => {
  return (
    <div className="messages-container" style={{ opacity: 0.5 }}>
      <div className="message other">
        <div className="message-bubble">
          <Skeleton width={150} />
        </div>
      </div>
      <div className="message own">
        <div className="message-bubble">
          <Skeleton width={200} />
        </div>
      </div>
      <div className="message other">
        <div className="message-bubble">
          <Skeleton width={120} />
          <Skeleton width={80} />
        </div>
      </div>
      <div className="message own">
        <div className="message-bubble">
          <Skeleton width={180} />
        </div>
      </div>
    </div>
  );
};

export default MessageSkeleton;
