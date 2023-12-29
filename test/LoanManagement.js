const { assert } = require('chai');

require('chai')
    .use(require('chai-as-promised'))
    .should();

const LoanManagementContract = artifacts.require('./LoanManagementContract.sol');
const BorrowingContract = artifacts.require('./BorrowingContract.sol');
const PoolLendingContract = artifacts.require('./PoolLendingContract.sol');

contract('LoanManagementContract', ([deployer, borrower, lender]) => {
    let loanManagementContract;

    before(async () => {
        loanManagementContract = await LoanManagementContract.deployed();
    });

    describe('LoanManagement Contract Deployment', async () => {
        it('Deploys successfully', async () => {
            const address = await loanManagementContract.address;
            assert.notEqual(address, 0x0);
            assert.notEqual(address, '');
            assert.notEqual(address, null);
            assert.notEqual(address, undefined);
        });
    });

    describe('Lending Contract Creation', async () => {
        let result;

        it('Create lending contract', async () => {
            const fundsToSend = web3.utils.toWei('10', 'Ether');
            result = await loanManagementContract.createLendingContract({ from: lender, value: fundsToSend });
        
            assert.equal(result.logs.length > 0, true, "Expected at least one event to be emitted");
            const event = result.logs.find(log => log.event === 'PoolLendingContractCreated');
            assert.exists(event, "LendingContractCreated event should be emitted");
        
            const lendingContractAddress = event.args.lendingContractAddress;
            const eventLender = event.args.lender;
            const totalFunds = event.args.totalFunds;
        
            assert.isTrue(web3.utils.isAddress(lendingContractAddress), "The lending contract address should be a valid address");
            assert.equal(eventLender, lender, "The lender address should match the sender");
            assert.equal(totalFunds.toString(), fundsToSend, "The total funds should match the sent value");
            
        });
    });

    describe('Borrowing Contract Creation', async () => {
        let result, lendingContractInstance, borrowingContractAddress;
    
        before(async () => {
            // Deploy a lending contract with some funds
            await loanManagementContract.createLendingContract({ from: lender, value: web3.utils.toWei('10', 'Ether') });
            const lendingContracts = await loanManagementContract.getLendingContractsByLender(lender);
            lendingContractInstance = await PoolLendingContract.at(lendingContracts[0]);
        });
    
        it('Create borrowing contract', async () => {
            const productName = "Test Product";
            const productValue = web3.utils.toWei('2', 'Ether');
            const loanAmount = web3.utils.toWei('1', 'Ether');
            const interestRate = 25; // 25%
            const dueDate = 30; // 30 days
    
            result = await loanManagementContract.createBorrowingContract(
                lendingContractInstance.address,
                loanAmount,
                interestRate,
                dueDate,
                productName,
                productValue,
                { from: borrower }
            );
    
            assert.equal(result.logs.length > 0, true, "Expected at least one event to be emitted");
            const event = result.logs.find(log => log.event === 'BorrowingContractCreated');
            assert.exists(event, "BorrowingContractCreated event should be emitted");
    
            borrowingContractAddress = event.args.borrowingContractAddress;
            assert.equal(event.args.borrower, borrower, "Borrower address should match");
            assert.equal(event.args.amount.toString(), loanAmount, "Loan amount should match");
            assert.equal(event.args.productName, productName, "Product name should match");
            assert.equal(event.args.productValue.toString(), productValue, "Product value should match");
    
        });
    });
});