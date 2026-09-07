import React from 'react';

export default function FeeApprovalModal({
  feeModalStudent,
  setFeeModalStudent,
  feeStatus,
  setFeeStatus,
  feeAmount,
  setFeeAmount,
  feePaymentMethod,
  setFeePaymentMethod,
  feeNotes,
  setFeeNotes,
  feeSubmitting,
  handleMarkFeePaid
}) {
  if (!feeModalStudent) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
      <div className="glass-card" style={{ width: '480px', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Admin Fee Payment Approval</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Student: <b>{feeModalStudent.name}</b> ({feeModalStudent.roll_number})
          </span>
        </div>

        <form onSubmit={handleMarkFeePaid} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Payment Status</label>
            <select 
              className="input-field"
              value={feeStatus}
              onChange={e => setFeeStatus(e.target.value)}
              style={{ background: 'var(--bg-main)' }}
            >
              <option value="paid">Paid (Fully Cleared)</option>
              <option value="partial">Partial Payment</option>
              <option value="pending">Pending / Unpaid</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Amount to Credit (₹)</label>
            <input 
              type="number"
              step="0.01"
              className="input-field"
              placeholder="e.g. 5000"
              value={feeAmount}
              onChange={e => setFeeAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Payment Method / Verification Source</label>
            <select 
              className="input-field"
              value={feePaymentMethod}
              onChange={e => setFeePaymentMethod(e.target.value)}
              style={{ background: 'var(--bg-main)' }}
            >
              <option value="Campus Cashier Counter">Campus Cashier Counter</option>
              <option value="UPI / QR Payment">UPI / QR Payment</option>
              <option value="Bank Direct Deposit / NEFT">Bank Direct Deposit / NEFT</option>
              <option value="Official College Cheque">Official College Cheque</option>
              <option value="Admin Scholarship / Fee Waiver">Admin Scholarship / Fee Waiver</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Admin Audit Notes (Optional)</label>
            <input 
              type="text"
              className="input-field"
              placeholder="Receipt # / Approval reference"
              value={feeNotes}
              onChange={e => setFeeNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
            <button type="submit" disabled={feeSubmitting} className="btn-primary">
              {feeSubmitting ? 'Recording...' : 'Confirm & Approve Fee'}
            </button>
            <button type="button" onClick={() => setFeeModalStudent(null)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
