import { useSocket } from '../context/SocketContext';
import CallModal from './CallModal';

// This wrapper will show CallModal for both caller and receiver, with correct expert/user info
const CallModalWrapper = () => {
  const { activeCall, incomingCall } = useSocket();

  // Show modal if there's an active call or incoming call
  if (activeCall && activeCall.status !== 'ended') {
    // For user, pass expert info; for expert, pass user info as 'expert' prop
    return <CallModal expert={activeCall.expert || activeCall.expertInfo || { user: { name: activeCall.expertName, avatar: activeCall.expertAvatar }, tokensPerMinute: activeCall.tokensPerMinute, title: activeCall.expertTitle }} onClose={() => {}} />;
  }
  if (incomingCall) {
    // For expert, show caller info as 'expert' prop
    return <CallModal expert={{ user: { name: incomingCall.callerInfo?.name || 'User', avatar: incomingCall.callerInfo?.avatar }, tokensPerMinute: incomingCall.tokensPerMinute, title: incomingCall.callerTitle || '' }} onClose={() => {}} />;
  }
  return null;
};

export default CallModalWrapper;
