// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

interface IComptroller {
    function getAccountLiquidity(address account) view external returns (uint error, uint liquidity, uint shortfall);
    function closeFactorMantissa() view external returns (uint);
    function liquidateCalculateSeizeTokens(address cTokenBorrowed, address cTokenCollateral, uint actualRepayAmount)
        external view returns (uint error , uint ctokenAmount);
}

interface CToken {
    function borrowBalanceStored(address account) external view returns (uint);
    function balanceOf(address account) view external returns (uint);
    function underlying() view external returns(address);
}

interface BAMMLike {
    function LUSD() view external returns(uint);
    function cBorrow() view external returns(address);
    function cETH() view external returns(address);
}

interface ILiquidationBotHelper {
    function getInfoFlat(address[] memory accounts, address comptroller, address[] memory bamms)
        external view returns(address[] memory users, address[] memory bamm, uint[] memory repayAmount);
}

contract LiquidationBotHelper {
    struct Account {
        address account;
        address bamm;
        uint repayAmount;
    }

    function getAccountInfo(address account, IComptroller comptroller, BAMMLike bamm) public view returns(Account memory a) {
        CToken cBorrow = CToken(bamm.cBorrow());
        CToken cETH = CToken(bamm.cETH());

        a.account = account;
        a.bamm = address(bamm);

        uint debt = cBorrow.borrowBalanceStored(account);

        uint repayAmount = debt * comptroller.closeFactorMantissa() / 1e18;
        
        uint bammBalance = CToken(cBorrow.underlying()).balanceOf(address(bamm));
        if(repayAmount > bammBalance) repayAmount = bammBalance;

        if(repayAmount == 0) return a;
        (uint err, uint cETHAmount) = comptroller.liquidateCalculateSeizeTokens(address(cBorrow), address(cETH), repayAmount);
        if(cETHAmount == 0 || err != 0) return a;

        uint cETHBalance = cETH.balanceOf(account);
        if(cETHBalance < cETHAmount) {
            repayAmount = cETHBalance * repayAmount / cETHAmount;
        }

        a.repayAmount = repayAmount;
    }

    function getInfo(address[] memory accounts, address comptroller, address[] memory bamms) public view returns(Account[] memory unsafeAccounts) {
        if(accounts.length == 0) return unsafeAccounts;

        Account[] memory actions = new Account[](accounts.length);
        uint numUnsafe = 0;
        
        for(uint i = 0 ; i < accounts.length ; i++) {
            (uint err,, uint shortfall) = IComptroller(comptroller).getAccountLiquidity(accounts[i]);
            if(shortfall == 0 || err != 0) continue;

            Account memory a;
            for(uint j = 0 ; j < bamms.length ; j++) {
                a = getAccountInfo(accounts[i], IComptroller(comptroller), BAMMLike(bamms[j]));
                if(a.repayAmount > 0) {
                    actions[numUnsafe++] = a;
                    break;
                }
            }
        }

        unsafeAccounts = new Account[](numUnsafe);
        for(uint k = 0 ; k < numUnsafe ; k++) {
            unsafeAccounts[k] = actions[k];
        }
    }

    function getInfoFlat(address[] memory accounts, address comptroller, address[] memory bamms) 
        external returns(address[] memory users, address[] memory bamm, uint[] memory repayAmount)    
    {
        Account[] memory unsafeAccounts = getInfo(accounts, comptroller, bamms);

        if(unsafeAccounts.length == 0) return (users, bamm, repayAmount);

        users = new address[](unsafeAccounts.length);
        bamm = new address[](unsafeAccounts.length);
        repayAmount = new uint[](unsafeAccounts.length);

        for(uint i = 0 ; i < unsafeAccounts.length ; i++) {
            users[i] = unsafeAccounts[i].account;
            bamm[i] = unsafeAccounts[i].bamm;
            repayAmount[i] = unsafeAccounts[i].repayAmount;
        }
    }    
}


contract CheapTest {
    function getInfoFlat(address[] memory accounts, address comptroller, address[] memory bamms) 
        external returns(address[] memory users, address[] memory bamm, uint[] memory repayAmount)    
    {
        users = new address[](1);
        bamm = new address[](1);
        repayAmount = new uint[](1);

        users[0] = address(this);
        bamm[0] = address(this);
        repayAmount[0] = 777;
    }
}


contract CheapHelper {
    function getInfo(bytes memory code, address[] calldata accounts, address comptroller, address[] calldata bamms)
        external returns(address[] memory users, address[] memory bamm, uint[] memory repayAmount)
    {
        address proxy;
        bytes32 salt = bytes32(0);
        assembly {
            proxy := create2(0, add(code, 0x20), mload(code), salt)
        }

        return ILiquidationBotHelper(proxy).getInfoFlat(accounts, comptroller, bamms);        
    }
}

