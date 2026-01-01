import { useState } from 'react';
import { FiCheck, FiCreditCard, FiDollarSign } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import './AddBalance.css';

const AddBalance = () => {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(null);

  const presetAmounts = [100, 200, 500, 1000, 2000];

  const handlePresetClick = (preset) => {
    setAmount(preset.toString());
    setSelectedPreset(preset);
  };

  const handleAmountChange = (e) => {
    setAmount(e.target.value);
    setSelectedPreset(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const amountNum = parseInt(amount);
    if (!amountNum || amountNum < 100) {
      toast.error('Minimum recharge amount is ₹100');
      return;
    }

    setLoading(true);
    try {
      // Simulate payment (in real app, integrate with payment gateway)
      const res = await axios.post('/api/users/add-balance', { amount: amountNum });
      
      updateBalance(res.data.balance);
      toast.success(`₹${amountNum} added to your wallet!`);
      navigate('/dashboard');
    } catch (error) {
      console.error('Add balance error:', error);
      toast.error(error.response?.data?.message || 'Failed to add balance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-balance-page">
      <div className="container">
        <div className="add-balance-container">
          <div className="balance-header">
            <h1>Add Balance</h1>
            <p>Add funds to your wallet to make calls with experts</p>
          </div>

          <div className="current-balance-card">
            <div className="balance-icon">
              <FiDollarSign />
            </div>
            <div className="balance-info">
              <span className="balance-label">Current Balance</span>
              <span className="balance-value">₹{user?.balance?.toFixed(2) || '0.00'}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="add-balance-form">
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
                    ₹{preset}
                    {selectedPreset === preset && <FiCheck className="check-icon" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label>Or Enter Custom Amount</label>
              <div className="amount-input-wrapper">
                <span className="currency-symbol">₹</span>
                <input
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={handleAmountChange}
                  className="amount-input"
                  min="100"
                />
              </div>
              <span className="input-hint">Minimum: ₹100</span>
            </div>

            <div className="payment-methods">
              <label>Payment Method</label>
              <div className="payment-option selected">
                <FiCreditCard />
                <span>Demo Payment (Instant)</span>
                <div className="payment-badge">Recommended</div>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full"
              disabled={loading || !amount || parseInt(amount) < 100}
            >
              {loading ? (
                <span className="spinner"></span>
              ) : (
                <>Add ₹{amount || '0'} to Wallet</>
              )}
            </button>

            <p className="payment-note">
              💡 This is a demo payment. In production, integrate with Razorpay, Stripe, or other payment gateways.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddBalance;
