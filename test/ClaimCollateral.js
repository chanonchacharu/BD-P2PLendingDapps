const LoanManagementContract = artifacts.require('LoanManagementContract');
const PoolLendingContract = artifacts.require('PoolLendingContract');
const BorrowingContract = artifacts.require('BorrowingContract');
const { expect } = require('chai');

contract('LoanManagementContract', ([deployer, lender, borrower]) => {
    let loanManagementContract, lendingContract, borrowingContract;
    let lendingContractAddress, borrowingContractAddress;

    before(async () => {
        loanManagementContract = await LoanManagementContract.deployed();

        const lendingResult = await loanManagementContract.createLendingContract({ from: lender, value: web3.utils.toWei('10', 'Ether') });
        lendingContractAddress = lendingResult.logs[0].args.lendingContractAddress;
        lendingContract = await PoolLendingContract.at(lendingContractAddress);

        const borrowingResult = await loanManagementContract.createBorrowingContract(
            lendingContractAddress,
            web3.utils.toWei('1', 'Ether'), // Loan amount
            25, // Interest rate
            0, // Past due date
            "Test Product",
            web3.utils.toWei('2', 'Ether'), // Product value
            { from: borrower }
        );
        borrowingContractAddress = borrowingResult.logs[0].args.borrowingContractAddress;
        borrowingContract = await BorrowingContract.at(borrowingContractAddress);
    });

    it('Claim collateral after loan due date', async () => {
        const result = await loanManagementContract.lenderClaimCollateralFromLoan(borrowingContractAddress, { from: lender });

        expect(result.logs.length).to.be.gt(0, "Expected at least one event to be emitted");
        const event = result.logs.find(log => log.event === 'CollateralClaimed');
        expect(event).to.not.be.undefined;
        expect(event.args.borrowingContractAddress).to.equal(borrowingContractAddress);
        expect(event.args.lender).to.equal(lender);

        const collateralOwner = await borrowingContract.getCollateralOwner();
        expect(collateralOwner).to.equal(lender, 'Collateral should be owned by the lender after claim');
    });
});
