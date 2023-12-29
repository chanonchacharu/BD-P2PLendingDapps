import React, { Component } from 'react';
import Web3 from 'web3';
import './App.css';
import LoanManagementContract from '../abis/LoanManagementContract.json';
import Navbar from './Navbar';

import royalCrest from './royalty-crest.png';
import loanRepayLogo from './loanNeedRepay.png';
import loanOverDueCrest from './loanOverDueBad.png';


class App extends Component {

  componentDidMount() {
    this.loadWeb3().then(() => {
      this.loadBlockchainData().then(() => {
        // Automatically calculate repayments for the logged-in lender after data load
        this.calculateExpectedRepayments(this.state.account);
        this.calculateBorrowerContracts(this.state.account);
        
        // Reload the blockchain data when change the wallet address 
        window.ethereum.on('accountsChanged', (accounts) => {
          if (accounts.length > 0) {
            this.setState({ account: accounts[0] }, () => {
              console.log("New account set:", this.state.account);
              this.loadBlockchainData().then(() => {
                this.calculateExpectedRepayments(this.state.account);
                this.calculateBorrowerContracts(this.state.account);
              });
            });
          } else {
            // Special Case: Handle the case where no accounts are available
            this.setState({
              account: '',
              lendingContracts: [],
              borrowingContracts: [],
            });
          }
        });
        

        // Listen for network changes
        window.ethereum.on('chainChanged', (chainId) => {
          window.location.reload();
        });
      });
    });
  }
  

    async loadWeb3() {
        if (window.ethereum) {
            window.web3 = new Web3(window.ethereum);
            await window.ethereum.enable();
        } else if (window.web3) {
            window.web3 = new Web3(window.web3.currentProvider);
        } else {
            window.alert('Non-Ethereum browser detected. You should consider trying MetaMask!');
        }
    }

    async loadBlockchainData() {
      const web3 = window.web3;
      const accounts = await web3.eth.getAccounts();
      this.setState({ account: accounts[0] });
      const networkId = await web3.eth.net.getId();
    
      const loanManagementData = LoanManagementContract.networks[networkId];
      if (loanManagementData) {
        const loanManagement = new web3.eth.Contract(LoanManagementContract.abi, loanManagementData.address);
        this.setState({ loanManagement });
        
        /*Lending Contract*/
        const lendingContractCount = await loanManagement.methods.lendingContractCount().call();
        let lendingContractsDetails = [];
    
        for (let i = 1; i <= lendingContractCount; i++) {
          const address = await loanManagement.methods.lendingContractAddresses(i).call();
          const summary = await loanManagement.methods.lendingContractSumamry(address).call();
    
          lendingContractsDetails.push({
            address,
            lenderAddress: summary._lender,
            totalFundsAvailable: web3.utils.fromWei(summary._availableFunds.toString(), 'ether')
          });
        }
        console.log(lendingContractsDetails);

        /* Borrowing Contract */
        const borrowingContractCount = await loanManagement.methods.borrowingContractCount().call();
        let borrowingContractsDetails = [];

        for (let i = 1; i <= borrowingContractCount; i++) {
          const address = await loanManagement.methods.borrowingContractAddresses(i).call();
          const summary = await loanManagement.methods.borrowingContractSummary(address).call();
          const collateral = await loanManagement.methods.getProductDetailsFromBorrowingContract(address).call();
      
          borrowingContractsDetails.push({
            borrowerAddress: summary._borrower,
            lenderAddress: summary._lender,
            borrowingContractAddress: summary._borrowingContractAddressFromSelf,
            lendingContractAddress: summary._lendingContractAddress,
            amount: web3.utils.fromWei(summary._amount.toString(), 'ether'),
            interestRate: summary._interestRate.toString(), // Convert BigNumber to string
            dueDate: new Date(summary._dueDate * 1000).toLocaleDateString(),
            totalRepayableAmount: web3.utils.fromWei(web3.utils.toBN(summary._totalRepayableAmount).toString(), 'ether'),
            isFunded: summary._isFunded,
            isRepaid: summary._isRepaid,
            /*Collaterla information */
            collateralName: collateral.name,
            collateralValue: web3.utils.fromWei(collateral.value.toString(), 'ether'), // Assuming 'value' is in Wei
            collateralOwner: collateral.owner
          });
        }
        console.log(borrowingContractsDetails);

        /*Houe-keeping */
        this.setState({
          lendingContracts: lendingContractsDetails,
          borrowingContracts: borrowingContractsDetails,
          loading: false
        });

      } else {
        window.alert('LoanManagement contract not deployed to detected network.');
      }
    }

    constructor(props) {
      super(props);
      this.state = {
          account: '',
          loanManagement: null,
          // For Storing Lending Contract Information
          lendingContracts: [],
          lendingContractCount: 0,
          lendingAmount: 0,
          // For Storing Borrowing Contract Information
          borrowingContracts: [],
          lendingContractAddressToBorrow: '',
          borrowAmount: '',
          borrowInterestRate: '',
          borrowDueDate: '',
          borrowProductName: '',
          borrowProductValue: '',
          // Extra Functionalities
          expectedRepayments: 0,
          potentialCollateralToClaim: [],
          borrowerContracts: [],
          totalRepayableByBorrower: 0,
          repayableByLender: {},
          // House-keeping
          currentPage: 'main',
          loading: true
      };

      this.createLendingContract = this.createLendingContract.bind(this);
      this.handleLendingAmountChange = this.handleLendingAmountChange.bind(this);

      this.createBorrowingContract = this.createBorrowingContract.bind(this);

      this.repayLoan = this.repayLoan.bind(this);
      this.claimCollateral = this.claimCollateral.bind(this);

      this.navigateTo = this.navigateTo.bind(this);
      this.calculateExpectedRepayments = this.calculateExpectedRepayments.bind(this);
      this.handleLenderAddressSubmit = this.handleLenderAddressSubmit.bind(this);

      this.calculateBorrowerContracts = this.calculateBorrowerContracts.bind(this);
    }

    handleLendingAmountChange(event) {
      this.setState({ lendingAmount: event.target.value });
    }
    
    handleInputChange = (event) => {
      const { name, value } = event.target;
      this.setState({ [name]: value });
    };

    handleLenderAddressSubmit = (event) => {
      event.preventDefault();
      const lenderAddress = this.state.account; // or get from an input field if you want users to be able to check for any address
      this.calculateExpectedRepayments(lenderAddress);
    }

    navigateTo(page) {
      this.setState({ currentPage: page });
    }
    

    /*LENDING CONTRACT*/ 
    createLendingContract() {
      const amountInEther = this.state.lendingAmount;
      if (!amountInEther) {
        alert('Please enter an amount to lend.');
        return;
      }
      if (!window.web3) {
        alert('Web3 is not loaded. Please check if MetaMask is installed and connected.');
        return;
      }
      this.setState({ loading: true });
      this.state.loanManagement.methods.createLendingContract()
        .send({
          from: this.state.account,
          value: window.web3.utils.toWei(amountInEther, 'Ether')
        })
        .on('confirmation', () => {
          this.setState({ loading: false });
          window.location.reload(); // Refresh to see the new contract
        })
        .on('error', (error) => {
          this.setState({ loading: false });
          console.error(error);
          window.location.reload();
        });
    }

    renderLendingContracts() {
      return this.state.lendingContracts.map(({ address, lenderAddress, totalFundsAvailable }, index) => (
          <div key={index} className='contract-container'>
              <p className='contract-title'>Lending Contract #{index + 1}: {address}</p>
              <p>Lender Address: {lenderAddress}</p>
              <p>Total Available Funds: {totalFundsAvailable} ETH</p>
          </div>
      ));
    }

    /*BORROWING CONTRACT*/
    createBorrowingContract = async () => {
      const {
        lendingContractAddressToBorrow,
        borrowAmount,
        borrowInterestRate,
        borrowDueDate,
        borrowProductName,
        borrowProductValue
      } = this.state;
  
      const amountInWei = window.web3.utils.toWei(borrowAmount, 'ether');
      const productValueInWei = window.web3.utils.toWei(borrowProductValue, 'ether');
  
      this.setState({ loading: true });
      this.state.loanManagement.methods.createBorrowingContract(
        lendingContractAddressToBorrow.trim(),
        amountInWei,
        borrowInterestRate,
        borrowDueDate,
        borrowProductName,
        productValueInWei
      ).send({ from: this.state.account })
      .on('transactionHash', (hash) => {
        console.log('Transaction hash:', hash);
      })
      .on('confirmation', (confirmationNumber, receipt) => {
        console.log('Borrowing contract created', receipt);
        this.setState({ loading: false });
        window.location.reload();
      })
      .on('error', (error) => {
        console.error('Error creating borrowing contract', error);
        this.setState({ loading: false });
        window.location.reload();
      });
    };

    /* Render Borrowing Contract with Repay Loan Option */
    renderBorrowingContracts() {
      const { account } = this.state; 
      const currentDate = new Date();

      return this.state.borrowingContracts.map(({
        borrowingContractAddress,
        lenderAddress,
        borrowerAddress,
        amount,
        interestRate,
        dueDate,
        totalRepayableAmount,
        isFunded,
        isRepaid,
        collateralName,
        collateralValue,
        collateralOwner
      }, index) => {
      
        const dueDateObj = new Date(dueDate);
        const isLoanOverdue = currentDate > dueDateObj;
        const isBorrower = account === borrowerAddress;
        const isLender = account === lenderAddress;
        const collateralClaimed = isLender && (lenderAddress === collateralOwner);
        const allowRepayment = isBorrower && isFunded && !isRepaid && !isLoanOverdue;
        const allowClaimCollateral = isLender && isFunded && !isRepaid && isLoanOverdue;

        const overdueClass = isLoanOverdue && !isRepaid ? 'overdue-loan' : '';
        const claimedCollateralClass = collateralClaimed ? 'claimed-collateral' : '';

        let loanStatusImage, statusText;
        if (isRepaid) {
          loanStatusImage = royalCrest;
          statusText = "Loan Repaid";
        } else if (isLoanOverdue) {
          loanStatusImage = loanOverDueCrest;
          statusText = "Loan Overdue";
        } else {
          loanStatusImage = loanRepayLogo;
          statusText = "Repayment Needed";
        }

        return (
          <div key={index} className={`contract-container ${overdueClass} ${claimedCollateralClass}`}>
            <div className='borrowing-contract-container'>
              <div className="contract-image-container">
                <img src={loanStatusImage} alt={statusText} className="loan-status-image" />
                <p className="loan-status-text">{statusText}</p>
              </div>     
            </div>
            <p className='contract-title'>Borrowing Contract #{index + 1}: {borrowingContractAddress}</p>
            <p>Borrower Address: {borrowerAddress}</p>
            <p>Lender Address: {lenderAddress}</p>
            <p>Amount Borrowed: {amount} ETH</p>
            <p>Interest Rate: {interestRate}%</p>
            <p>Due Date: {dueDateObj.toLocaleDateString()}</p>
            <p>Total Repayable Amount: {totalRepayableAmount} ETH</p>
            <p>Funded: {isFunded ? 'Yes' : 'No'}</p>
            <p>Repaid: {isRepaid ? 'Yes' : 'No'}</p>

            <div className={`collateral-container ${claimedCollateralClass}`}>
              <h5>Collateral Details</h5>
              <p>Collateral Name: {collateralName}</p>
              <p>Collateral Value: {collateralValue} ETH</p>
              <p>Collateral Owner: {collateralOwner}</p>
              {collateralClaimed && (
                <p className="collateral-claimed-notice">Collateral Claimed</p>
              )}
            </div>

            {allowRepayment && (
              <div className='repay-section'>
                <input
                  type="number"
                  value={this.state.repaymentAmount}
                  onChange={e => this.setState({ repaymentAmount: e.target.value })}
                  placeholder="Repayment Amount in ETH"
                />
                <button onClick={() => this.repayLoan(borrowingContractAddress, this.state.repaymentAmount)}>
                  Repay Loan
                </button>
              </div>
            )}

            {allowClaimCollateral && (
              <div className='claim-collateral-section'>
                <div className="button-container">
                  <button onClick={() => this.claimCollateral(borrowingContractAddress)} disabled={collateralClaimed}>
                    Claim Collateral
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      });
    }

    renderBorrowingContractForm() {
      return (
        <div className="form-container">
          <h3>Create Borrowing Contract</h3>
          <form onSubmit={this.createBorrowingContract}>
            <div className="form-field-container">
              <label htmlFor="lendingContractAddressToBorrow">Lending Contract Address:</label>
              <input
                type="text"
                id="lendingContractAddressToBorrow"
                name="lendingContractAddressToBorrow"
                value={this.state.lendingContractAddressToBorrow}
                onChange={this.handleInputChange}
                placeholder="Lending Contract Address"
              />
            </div>
            <div className="form-field-container">
              <label htmlFor="borrowAmount">Amount to borrow (ETH):</label>
              <input
                type="text"
                id="borrowAmount"
                name="borrowAmount"
                value={this.state.borrowAmount}
                onChange={this.handleInputChange}
                placeholder="Amount to borrow (ETH)"
              />
            </div>
            <div className="form-field-container">
              <label htmlFor="borrowInterestRate">Loan-to-value (LTV):</label>
              <input
                type="text"
                id="borrowInterestRate"
                name="borrowInterestRate"
                value={this.state.borrowInterestRate}
                onChange={this.handleInputChange}
                placeholder="ltv either 25, 50, or 70"
              />
            </div>
            <div className="form-field-container">
              <label htmlFor="borrowDueDate">Loan Duration (in days):</label>
              <input
                type="text"
                id="borrowDueDate"
                name="borrowDueDate"
                value={this.state.borrowDueDate}
                onChange={this.handleInputChange}
                placeholder="Either 0, 30, or 365 days"
              />
            </div>
            <div className="form-field-container">
              <label htmlFor="borrowProductName">Product Name:</label>
              <input
                type="text"
                id="borrowProductName"
                name="borrowProductName"
                value={this.state.borrowProductName}
                onChange={this.handleInputChange}
                placeholder="Product Name"
              />
            </div>
            <div className="form-field-container">
              <label htmlFor="borrowProductValue">Product Value (ETH):</label>
              <input
                type="text"
                id="borrowProductValue"
                name="borrowProductValue"
                value={this.state.borrowProductValue}
                onChange={this.handleInputChange}
                placeholder="Product Value (ETH)"
              />
            </div>
            <button type="submit">Create Borrowing Contract</button>
          </form>
        </div>
      );
    }
    
    /*Borrower Repay the Loan Management */
    repayLoan = async (borrowingContractAddress, amountToRepay) => {
      const { loanManagement, account } = this.state;
      const { web3 } = window;
    
      // Convert the repayment amount to Wei
      const amountInWei = web3.utils.toWei(amountToRepay, 'ether');
    
      // Call the repayLoan function from the smart contract
      try {
        this.setState({ loading: true });
        await loanManagement.methods.borrowerRepayLoan(borrowingContractAddress).send({
          from: account,
          value: amountInWei
        }).on('transactionHash', (hash) => {
          console.log("Transaction hash:", hash);
        }).on('confirmation', (confirmationNumber, receipt) => {
          this.setState({ loading: false });
          alert('Loan repaid successfully');
          window.location.reload(); // Optionally reload the page to update the UI
        }).on('error', (error) => {
          this.setState({ loading: false });
          console.error('Error repaying loan:', error);
          alert('Error repaying loan');
        });
      } catch (error) {
        this.setState({ loading: false });
        console.error('Error during loan repayment:', error);
        alert('Error during loan repayment. Make sure you are the borrower and you are repaying the correct amount.');
      }
    }
    
    /*Lender Claim the Collateral from Loan */
    claimCollateral = async (borrowingContractAddress) => {
      if (!window.web3) {
        alert('Web3 is not loaded. Please check if MetaMask is installed and connected.');
        return;
      }
    
      try {
        this.setState({ loading: true });
        await this.state.loanManagement.methods.lenderClaimCollateralFromLoan(borrowingContractAddress)
          .send({ from: this.state.account })
          .on('transactionHash', (hash) => {
            console.log('Transaction hash:', hash);
          })
          .on('confirmation', (confirmationNumber, receipt) => {
            console.log('Collateral claimed', receipt);
            this.setState({ loading: false });
            // Optionally, refresh the contract data to reflect the changes
            this.loadBlockchainData();
          })
          .on('error', (error) => {
            alert('An error occurred while claiming the collateral.');
            console.error(error);
            this.setState({ loading: false });
          });
      } catch (error) {
        alert('An error occurred when claiming collateral.');
        console.error('Error claiming collateral', error);
        this.setState({ loading: false });
      }
    };
    
    /*Individual Wallet Information - All Lending and Borrowing Associated with them! */
    calculateExpectedRepayments = (lenderAddress) => {
      const { borrowingContracts } = this.state;
      const currentDate = new Date();
    
      let expectedRepayments = 0;
      let potentialCollateralToClaim = [];
      let totalCollateralValue = 0;
    
      borrowingContracts.forEach(contract => {
        const contractDueDate = new Date(contract.dueDate);
        if (contract.lenderAddress.toLowerCase() === lenderAddress.toLowerCase() && !contract.isRepaid) {
          if (currentDate <= contractDueDate) {
            expectedRepayments += parseFloat(contract.totalRepayableAmount);
          } else {
            potentialCollateralToClaim.push({
              borrowingContractAddress: contract.borrowingContractAddress,
              collateralName: contract.collateralName,
              collateralValue: parseFloat(contract.collateralValue)
            });
            totalCollateralValue += parseFloat(contract.collateralValue);
          }
        }
      });
    
      this.setState({ 
        expectedRepayments: expectedRepayments.toFixed(2),
        potentialCollateralToClaim,
        totalCollateralValue: totalCollateralValue.toFixed(2)
      });
    }
    
    /*Render the Second Page of the Application to Shows the Amount of Money owed and Expected to receive back */
    renderExpectedRepaymentsPage = () => {
      const { account, borrowingContracts, expectedRepayments, totalCollateralValue, totalRepayableByBorrower, repayableByLender, potentialCollateralToClaim } = this.state;
    
      return (
        <div className="expected-repayments-page">
          <h1>Account Summary</h1>
          <p>Current Wallet: {account}</p> {/* Displaying the current wallet address */}
          <div className="columns">
            <div className="column-left"> {/* Column for Lending Information */}
              <h2 className="section-title">Lending Contracts</h2>
              <h3 className="content-container">Expected Repayments: {expectedRepayments} ETH</h3>
              {/* Render Lending Information */}
              {borrowingContracts
                .filter(contract =>
                  contract.lenderAddress.toLowerCase() === account.toLowerCase() &&
                  !contract.isRepaid &&
                  new Date() <= new Date(contract.dueDate)
                )
                .map((contract, index) => (
                  <div key={index} className='contract-detail-container'>
                    <p>Borrowing Contract: {contract.borrowingContractAddress}</p>
                    <p>Amount Owed: {contract.totalRepayableAmount} ETH</p>
                  </div>
                ))
              }
              <h3 className="content-container">Potential Collateral to Claim: {totalCollateralValue} ETH</h3>
              {potentialCollateralToClaim.map((claim, index) => (
                <div key={index} className='contract-detail-container'>
                  <p>Borrowing Contract: {claim.borrowingContractAddress}</p>
                  <p>Collateral Name: {claim.collateralName}</p>
                  <p>Value: {claim.collateralValue} ETH</p>
                </div>
              ))}
            </div>
            <div className="column-right"> {/* Column for Borrowing Information */}
              <h2 className="section-title">Borrowing Contracts</h2>
              <h3 className="content-container">Total Repayable: {totalRepayableByBorrower} ETH</h3>

              {borrowingContracts
                .filter(contract =>
                  contract.borrowerAddress.toLowerCase() === account.toLowerCase() &&
                  !contract.isRepaid &&
                  new Date() <= new Date(contract.dueDate)
                )
                .map((contract, index) => (
                  <div key={index} className="contract-detail-container">
                    <p><span className='wallet-address'>Borrowing Contract: </span>{contract.borrowingContractAddress}</p>
                    <p><span className='amount-owed'>Amount Owed: </span>{contract.totalRepayableAmount} ETH</p>
                    {contract.isFunded && (
                      <button onClick={() => this.repayLoan(contract.borrowingContractAddress, contract.totalRepayableAmount)}>
                        Repay Loan
                      </button>
                    )}
                  </div>
                ))
              }
              <h3 className="section-title">Amounts Owed by Lender</h3>
              {Object.entries(repayableByLender).map(([lenderAddress, amount], index) => (
                <div key={index} className="amounts-owed-container">
                  <p>Lender Address: {lenderAddress}</p>
                  <p>Amount Owed: {amount.toFixed(2)} ETH</p>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => this.navigateTo('main')} className="back-button">Back to Main Page</button>
        </div>
      );
    }

    calculateBorrowerContracts = (borrowerAddress) => {
      const { borrowingContracts } = this.state;
      
      let totalRepayableByBorrower = 0;
      let repayableByLender = {};
    
      const currentDate = new Date();
    
      borrowingContracts.forEach(contract => {
        const dueDate = new Date(contract.dueDate);
        if (contract.borrowerAddress.toLowerCase() === borrowerAddress.toLowerCase() &&
            !contract.isRepaid &&
            currentDate <= dueDate) {
          totalRepayableByBorrower += parseFloat(contract.totalRepayableAmount);
          if(repayableByLender[contract.lenderAddress]) {
            repayableByLender[contract.lenderAddress] += parseFloat(contract.totalRepayableAmount);
          } else {
            repayableByLender[contract.lenderAddress] = parseFloat(contract.totalRepayableAmount);
          }
        }
      });
      
      this.setState({ 
        borrowerContracts: borrowingContracts.filter(contract => 
          contract.borrowerAddress.toLowerCase() === borrowerAddress.toLowerCase() &&
          !contract.isRepaid &&
          currentDate <= new Date(contract.dueDate)
        ),
        totalRepayableByBorrower: totalRepayableByBorrower.toFixed(2),
        repayableByLender: repayableByLender
      });
    }
    
    
    renderBorrowerContracts = () => {
      return this.state.borrowerContracts.map((contract, index) => (
        <div key={index}>
          <p>Borrowing Contract: {contract.borrowingContractAddress}</p>
          <p>Lender Address: {contract.lenderAddress}</p>
          <p>Amount Borrowed: {contract.amount} ETH</p>
          <p>Interest Rate: {contract.interestRate}%</p>
          <p>Due Date: {contract.dueDate}</p>
          <p>Total Repayable Amount: {contract.totalRepayableAmount} ETH</p>
          <p>Funded: {contract.isFunded ? 'Yes' : 'No'}</p>
          <p>Repaid: {contract.isRepaid ? 'Yes' : 'No'}</p>
        </div>
      ));
    }

    /*Main page render all the contract interactions */
    renderMainPage() {
      return (
        <div>
          <Navbar account={this.state.account} />
          <div className="container-fluid mt-5">
            <div className="row">
              <main role="main" className="col-lg-12 d-flex justify-content-center">
                {this.state.loading
                  ? <div id="loader" className="text-center"><p>Loading...</p></div>
                  : (
                    <div className="contracts-container">
                      <div className="column lending-column">
                        <h2>Available Lending Contracts</h2>
                        <p>
                          Put in some amount of ETH into the specified field. Press "Create Lending Contract" 
                          to create new contract!
                        </p>
                        <div>
                          <input
                            type="number"
                            value={this.state.lendingAmount}
                            onChange={this.handleLendingAmountChange}
                            placeholder="Amount to lend in ETH"
                            className="lending-input"
                          />
                          <button onClick={this.createLendingContract} className="create-lending-contract">Create Lending Contract</button>
                        </div>
                        {this.renderLendingContracts()}
                      </div>
                      <div className="column borrowing-column">
                        <h2>Borrowing Contracts</h2>
                        <p>
                          Browse through the available lending contracts. Pick one that you woud like to loan from.
                          Copy the "Lending Contract address" in the the first field of the form. Then input 
                          necessary information and make the quick and easy loan!
                        </p>
                        {this.renderBorrowingContractForm()}
                        {this.renderBorrowingContracts()}
                      </div>
                    </div>
                  )
                }
              </main>
            </div>
          </div>
          <button onClick={() => this.navigateTo('expectedRepayments')} className="view-summary-button">View Account Summary</button>
        </div>
      );
    }

    /*Render The Main Webpage */
    render() {
      const { currentPage } = this.state;
    
      return (
        <div>
          <Navbar account={this.state.account} />
          <div className="container-fluid mt-5">
            <div className="row">
              <main role="main" className="col-lg-12 d-flex">
                {this.state.loading
                  ? <div id="loader" className="text-center"><p>Loading...</p></div>
                  : (
                    <div>
                      {currentPage === 'main' && this.renderMainPage()}
                      {currentPage === 'expectedRepayments' && this.renderExpectedRepaymentsPage()}
                    </div>
                  )
                }
              </main>
            </div>
          </div>
        </div>
      );
    }
    
    /*End of render() */
}

export default App;

// Run this command to make the server works: set NODE_OPTIONS=--openssl-legacy-provider
