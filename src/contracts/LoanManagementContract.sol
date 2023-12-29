// SPDX-License-Identifier: MIT
pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./BorrowingContract.sol";
import "./PoolLendingContract.sol";

contract LoanManagementContract {
    string public dappName;

    mapping(address => address[]) public lendingContracts;
    mapping(address => address[]) public borrowingContracts;

    uint public lendingContractCount = 0;
    mapping(uint => address) public lendingContractAddresses;
    uint public borrowingContractCount = 0;
    mapping(uint => address) public borrowingContractAddresses;

    struct CollateralProduct {
        string name;
        uint value;
        address owner;
    }

    constructor() public {
        dappName = "BigBoy Lending Corp.";
    }

    event PoolLendingContractCreated(
        address lendingContractAddress,
        address lender,
        uint totalFunds
    );

    event BorrowingContractCreated(
        address borrowingContractAddress,
        address borrower,
        uint amount,
        string productName,
        uint productValue
    );

    event LoanRepaid(
        address borrowingContractAddress,
        address borrower,
        uint amountRepaid
    );

    event CollateralClaimed(
        address borrowingContractAddress,
        address lender,
        string collateralName
    );

    function createLendingContract() external payable {
        PoolLendingContract newLendingContract = (new PoolLendingContract)
            .value(msg.value)(msg.sender);
        lendingContracts[msg.sender].push(address(newLendingContract));

        lendingContractCount++;
        lendingContractAddresses[lendingContractCount] = address(
            newLendingContract
        );

        emit PoolLendingContractCreated(
            address(newLendingContract),
            msg.sender,
            msg.value
        );
    }

    function createBorrowingContract(
        address _lendingContractAddress,
        uint _amount,
        uint _interestRate,
        uint _dueDate,
        string calldata _productName,
        uint _productValue
    ) external {
        PoolLendingContract lendingContract = PoolLendingContract(
            _lendingContractAddress
        );
        require(
            _amount <= lendingContract.availableFunds(),
            "LMC: Insufficient funds"
        );
        require(
            bytes(_productName).length > 0,
            "LMC: Product cannot have no name"
        );
        require(
            _productValue > _amount,
            "LMC: Collateral must be creater than loan amount"
        );

        BorrowingContract newBorrowingContract = new BorrowingContract(
            msg.sender,
            _amount,
            _interestRate,
            _dueDate,
            _lendingContractAddress,
            _productName,
            _productValue
        );

        borrowingContracts[msg.sender].push(address(newBorrowingContract));
        lendingContract.lendFunds(msg.sender, _amount);
        newBorrowingContract.setLender(lendingContract.lenderAddress());

        borrowingContractCount++;
        borrowingContractAddresses[borrowingContractCount] = address(
            newBorrowingContract
        );

        // Retrieve values from the new borrowing contract (for event)
        string memory retrievedProductName = newBorrowingContract
            .getCollateralName();
        uint retrievedProductValue = newBorrowingContract.getCollateralValue();
        address retrievedBorrower = newBorrowingContract.borrowerAddress();
        uint retrievedLoanAmount = newBorrowingContract.loanAmount();

        emit BorrowingContractCreated(
            address(newBorrowingContract),
            retrievedBorrower,
            retrievedLoanAmount,
            retrievedProductName,
            retrievedProductValue
        );
    }

    function borrowerRepayLoan(
        address _borrowingContractAddress
    ) external payable {
        BorrowingContract borrowingContract = BorrowingContract(
            _borrowingContractAddress
        );
        require(
            address(borrowingContract) != address(0),
            "LMC: Borrowing Contract does not exist"
        );
        require(
            msg.sender == borrowingContract.borrowerAddress(),
            "LMC: Only borrower can repay the loan"
        );

        borrowingContract.repayLoan.value(msg.value)(msg.sender);

        emit LoanRepaid(_borrowingContractAddress, msg.sender, msg.value);
    }

    function lenderClaimCollateralFromLoan(
        address _borrowingContractAddress
    ) external {
        BorrowingContract borrowingContract = BorrowingContract(
            _borrowingContractAddress
        );
        require(
            address(borrowingContract) != address(0),
            "LMC: Borrowing Contract does not exist"
        );
        require(
            msg.sender == borrowingContract.lenderAddress(),
            "LMC: Only lender can claimed borrower's collateral"
        );

        borrowingContract.claimCollateral(msg.sender);

        string memory collateralName = borrowingContract.getCollateralName();
        emit CollateralClaimed(
            _borrowingContractAddress,
            msg.sender,
            collateralName
        );
    }

    function getLendingContractsByLender(
        address _lenderAddress
    ) external view returns (address[] memory) {
        return lendingContracts[_lenderAddress];
    }

    function getBorrowingContractByBorrwer(
        address _borrowerAddress
    ) external view returns (address[] memory) {
        return borrowingContracts[_borrowerAddress];
    }

    function lendingContractSumamry(
        address _lendingContractAddress
    )
        external
        view
        returns (
            address _lender,
            address _lendingContractAddressFromSelf,
            uint _totalFunds,
            uint _availableFunds
        )
    {
        require(
            address(PoolLendingContract(_lendingContractAddress)) != address(0),
            "LMC: Lending contract doesn't exist"
        );
        PoolLendingContract lendingContract = PoolLendingContract(
            _lendingContractAddress
        );
        return lendingContract.getSummary();
    }

    function borrowingContractSummary(
        address _borrowingContractAddress
    )
        external
        view
        returns (
            address _borrower,
            address _lender,
            address _borrowingContractAddressFromSelf,
            address _lendingContractAddress,
            uint _amount,
            uint _interestRate,
            uint _dueDate,
            uint _totalRepayableAmount,
            bool _isFunded,
            bool _isRepaid
        )
    {
        require(
            address(BorrowingContract(_borrowingContractAddress)) != address(0),
            "LMC: Borrowing contract doesn't exist"
        );
        BorrowingContract borrowingContract = BorrowingContract(
            _borrowingContractAddress
        );
        return borrowingContract.getSummary();
    }

    function getProductDetailsFromBorrowingContract(
        address _borrowingContractAddress
    ) external view returns (string memory name, uint value, address owner) {
        require(
            address(BorrowingContract(_borrowingContractAddress)) != address(0),
            "LMC: Borrowing contract doesn't exist"
        );

        BorrowingContract borrowingContract = BorrowingContract(
            _borrowingContractAddress
        );
        return (
            borrowingContract.getCollateralName(),
            borrowingContract.getCollateralValue(),
            borrowingContract.getCollateralOwner()
        );
    }

    function getAllProductsOwnedBy(
        address _owner
    ) external view returns (CollateralProduct[] memory) {
        address[] memory borrowerContracts = borrowingContracts[_owner];
        uint count = 0;

        for (uint i = 0; i < borrowerContracts.length; i++) {
            BorrowingContract borrowingContract = BorrowingContract(
                borrowerContracts[i]
            );
            if (borrowingContract.getCollateralOwner() == _owner) {
                count++;
            }
        }

        CollateralProduct[] memory ownedProducts = new CollateralProduct[](
            count
        );
        uint j = 0;

        for (uint i = 0; i < borrowerContracts.length; i++) {
            BorrowingContract borrowingContract = BorrowingContract(
                borrowerContracts[i]
            );
            if (borrowingContract.getCollateralOwner() == _owner) {
                string memory name = borrowingContract.getCollateralName();
                uint value = borrowingContract.getCollateralValue();
                address owner = borrowingContract.getCollateralOwner();

                CollateralProduct memory product = CollateralProduct(
                    name,
                    value,
                    owner
                );
                ownedProducts[j] = product;
                j++;
            }
        }
        return ownedProducts;
    }
}

// Testing:

// Lending: 10 Ether

// Borrowing: 1000000000000000000

// Borrowing: 5000000000000000000
// Collateral: 6000000000000000000

// Borrowing: 4000000000000000000
