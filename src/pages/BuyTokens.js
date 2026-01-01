import { useState } from 'react';
import { BiRupee } from 'react-icons/bi';
import { FiCheck, FiCreditCard, FiShield } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import DashboardLayout from '../components/DashboardLayout';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import './AddBalance.css';

const BuyTokens = () => {
  const { user, updateTokens } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(null);

  const presetAmounts = [100, 200, 500, 1000, 2000, 5000];

  const handlePresetClick = (preset) => {
    setAmount(preset.toString());
    setSelectedPreset(preset);
  };

  const handleAmountChange = (e) => {
    setAmount(e.target.value);
    setSelectedPreset(null);
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    const amountNum = parseInt(amount);
    if (!amountNum || amountNum < 100) {
      toast.error('Minimum amount is ₹100');
      return;
    }

    setLoading(true);
    
    try {
      // Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error('Failed to load payment gateway');
        setLoading(false);
        return;
      }

      // Create order
      const orderRes = await axios.post('/api/users/create-order', { amount: amountNum });
      const { orderId, keyId } = orderRes.data;

      // Configure Razorpay options
      const options = {
        key: keyId,
        amount: amountNum * 100,
        currency: 'INR',
        name: 'GuidanceHub',
        description: `Add ₹${amountNum} to wallet`,
        order_id: orderId,
        handler: async function (response) {
          try {
            // Verify payment on server
            const verifyRes = await axios.post('/api/users/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: amountNum
            });

            if (verifyRes.data.success) {
              updateTokens(verifyRes.data.tokens);
              toast.success(`₹${amountNum} added to your wallet!`);
              navigate('/dashboard');
            }
          } catch (error) {
            console.error('Payment verification error:', error);
            toast.error('Payment verification failed');
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || ''
        },
        theme: {
          color: '#6366f1'
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
      
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error.response?.data?.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  // Fallback demo payment
  const handleDemoPayment = async () => {
    const amountNum = parseInt(amount);
    if (!amountNum || amountNum < 10) {
      toast.error('Minimum amount is ₹10');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/users/buy-tokens', { tokens: amountNum });
      updateTokens(res.data.tokens);
      toast.success(`₹${amountNum} added to your wallet!`);
      navigate('/dashboard');
    } catch (error) {
      console.error('Add money error:', error);
      toast.error(error.response?.data?.message || 'Failed to add money');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Add Money">
      <div className="add-money-page">
        <div className="add-money-grid">
          {/* Main Form */}
          <div className="add-money-main">
            <div className="current-balance-card">
              <div className="balance-icon">
                <FiCreditCard />
              </div>
              <div className="balance-info">
                <span className="balance-label">Current Balance</span>
                <span className="balance-value"><BiRupee className="rupee-icon" />{user?.tokens || 0}</span>
              </div>
            </div>

            <div className="add-balance-form">
              <div className="preset-amounts">
                <label>Select Amount</label>
                <div className="preset-buttons">
                  {presetAmounts.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      className={`preset-btn ${selectedPreset === preset ? 'selected' : ''}`}
                      onClick={() => handlePresetClick(preset)}
                    >
                      <BiRupee className="rupee-icon" />{preset}
                      {selectedPreset === preset && <FiCheck className="check-icon" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label>Or Enter Custom Amount</label>
                <div className="amount-input-wrapper">
                  <BiRupee className="currency-symbol" />
                  <input
                    type="number"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={handleAmountChange}
                    className="amount-input"
                    min="10"
                    max="100000"
                  />
                </div>
                <span className="input-hint">Minimum: ₹10 • Maximum: ₹1,00,000</span>
              </div>

              <div className="payment-methods">
                <label>Payment Method</label>
                <div className="payment-option selected">
                  <img 
                    src="https://razorpay.com/favicon.png" 
                    alt="Razorpay" 
                    style={{ width: 20, height: 20 }} 
                  />
                  <span>Razorpay (Cards, UPI, NetBanking)</span>
                  <div className="payment-badge">Secure</div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-lg w-full pay-btn"
                onClick={handlePayment}
                disabled={loading || !amount || parseInt(amount) < 10}
              >
                {loading ? (
                  <span className="spinner"></span>
                ) : (
                  <>Pay ₹{amount || '0'}</>
                )}
              </button>

              <button
                type="button"
                className="btn btn-outline btn-lg w-full demo-btn"
                onClick={handleDemoPayment}
                disabled={loading || !amount || parseInt(amount) < 10}
              >
                Demo Payment (Skip Gateway)
              </button>

              <div className="payment-security">
                <FiShield />
                <span>Your payment is secured with 256-bit SSL encryption</span>
              </div>
            </div>
          </div>

          {/* Instructions Sidebar */}
          <div className="add-money-sidebar">
            <div className="instructions-card">
              <h3>How it works</h3>
              <div className="instruction-steps">
                <div className="instruction-step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <h4>Select Amount</h4>
                    <p>Choose a preset amount or enter a custom value</p>
                  </div>
                </div>
                <div className="instruction-step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <h4>Make Payment</h4>
                    <p>Pay securely via UPI, Cards, or NetBanking</p>
                  </div>
                </div>
                <div className="instruction-step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <h4>Start Calling</h4>
                    <p>Connect with experts instantly after payment</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="info-card">
              <h3>Important Notes</h3>
              <ul className="info-list">
                <li>Wallet balance is non-refundable</li>
                <li>Unused balance never expires</li>
                <li>₹1 = 1 minute with experts (rates vary)</li>
                <li>Get instant confirmation via email</li>
              </ul>
            </div>

            <div className="support-card">
              <h3>Need Help?</h3>
              <p>Contact our support team for payment related queries</p>
              <a href="mailto:support@guidancehub.com" className="support-link">
                support@guidancehub.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default BuyTokens;
