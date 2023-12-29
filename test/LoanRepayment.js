const LoanManagementContract = artifacts.require('LoanManagementContract');
const PoolLendingContract = artifacts.require('PoolLendingContract');
const BorrowingContract = artifacts.require('BorrowingContract');
const { expect } = require('chai');
const { BN, balance } = require('web3-utils');

contract('LoanManagementContract', ([deployer, lender, borrower]) => {
    let loanManagementContract, lendingContract, borrowingContract;
    let lendingContractAddress, borrowingContractAddress;
    let initialLenderBalance, finalLenderBalance;

    before(async () => {
        loanManagementContract = await LoanManagementContract.deployed();

        // Create Lending Contract
        await loanManagementContract.createLendingContract({ from: lender, value: web3.utils.toWei('10', 'Ether') });
        lendingContractAddress = (await loanManagementContract.getLendingContractsByLender(lender))[0];
        lendingContract = await PoolLendingContract.at(lendingContractAddress);

        // Create Borrowing Contract
        await loanManagementContract.createBorrowingContract(
            lendingContractAddress,
            web3.utils.toWei('1', 'Ether'), // Loan amount
            25, // Interest rate
            30, // Due date
            "Test Product",
            web3.utils.toWei('2', 'Ether'), // Product value
            { from: borrower }
        );
        borrowingContractAddress = (await loanManagementContract.getBorrowingContractByBorrwer(borrower))[0];
        borrowingContract = await BorrowingContract.at(borrowingContractAddress);
    });

    it('Borrower repay the loan with interest & lender\'s balance increased', async () => {
        initialLenderBalance = new BN(await web3.eth.getBalance(lender));

        const totalRepayableAmount = await borrowingContract.totalRepayableAmount();
        await loanManagementContract.borrowerRepayLoan(borrowingContractAddress, { from: borrower, value: totalRepayableAmount });

        finalLenderBalance = new BN(await web3.eth.getBalance(lender));
        const balanceIncrease = finalLenderBalance.sub(initialLenderBalance);

        expect(balanceIncrease.toString()).to.equal(totalRepayableAmount.toString(), 'Lender balance should increase by the total repayment amount');
    });

});
