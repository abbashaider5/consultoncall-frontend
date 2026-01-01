import { useEffect, useState } from 'react';
import { BiRupee } from 'react-icons/bi';
import { FiArrowDown, FiArrowUp, FiPhone } from 'react-icons/fi';
import { toast } from 'react-toastify';
import DashboardLayout from '../components/DashboardLayout';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import './TransactionHistory.css';

const TransactionHistory = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, credit, debit

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/users/transactions');
      setTransactions(res.data.transactions || []);
    } catch (error) {
      console.error('Fetch transactions error:', error);
      toast.error(error.response?.data?.message || 'Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredTransactions = transactions.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'credit') return t.type === 'credit';
    if (filter === 'debit') return t.type === 'debit';
    return true;
  });

  return (
    <DashboardLayout title="Transaction History">
      <div className="transaction-history-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Transaction History</h1>
            <p className="page-subtitle">View all your credits and debits</p>
          </div>
          <div className="balance-card-mini">
            <span className="balance-label">Current Balance</span>
            <div className="balance-amount">
              <BiRupee />
              {user?.tokens || 0}
            </div>
          </div>
        </div>

        <div className="filters">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${filter === 'credit' ? 'active' : ''}`}
            onClick={() => setFilter('credit')}
          >
            <FiArrowDown /> Credits
          </button>
          <button 
            className={`filter-btn ${filter === 'debit' ? 'active' : ''}`}
            onClick={() => setFilter('debit')}
          >
            <FiArrowUp /> Debits
          </button>
        </div>

        {loading ? (
          <div className="loading-state">Loading transactions...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="empty-state">
            <p>No transactions found</p>
          </div>
        ) : (
          <div className="transactions-list">
            {filteredTransactions.map((txn) => (
              <div key={txn._id} className={`transaction-item ${txn.type}`}>
                <div className="txn-icon">
                  {txn.type === 'credit' ? (
                    <FiArrowDown />
                  ) : (
                    <FiPhone />
                  )}
                </div>
                <div className="txn-details">
                  <h4 className="txn-title">{txn.description}</h4>
                  <span className="txn-date">{formatDate(txn.createdAt)}</span>
                </div>
                <div className={`txn-amount ${txn.type}`}>
                  {txn.type === 'credit' ? '+' : '-'}
                  <BiRupee /> {txn.amount}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TransactionHistory;
