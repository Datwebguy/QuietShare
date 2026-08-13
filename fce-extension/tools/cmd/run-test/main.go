package main

import (
	"crypto/rand"
	"encoding/json"
	"flag"
	"strings"
	"time"

	"extension-scaffold/tools/pkg/configs"
	"extension-scaffold/tools/pkg/fccutils"
	"extension-scaffold/tools/pkg/support"
	instrutils "extension-scaffold/tools/pkg/utils"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/flare-foundation/go-flare-common/pkg/logger"
	"github.com/pkg/errors"
)

// Expected response shape for QuietShare's GET_BALANCE operation.
//
// Declared here rather than imported from the extension: this tool asserts on
// the *wire format*, and must run unchanged against every language
// implementation (see docs/extension-contract.md). Mirrors the JSON shape
// returned by typescript/src/app/handlers.ts:handleGetBalance.
type getBalanceResponse struct {
	PotId   string `json:"potId"`
	Member  string `json:"member"`
	Balance string `json:"balance"`
}

func main() {
	af := flag.String("a", configs.AddressesFile, "file with deployed addresses")
	cf := flag.String("c", configs.ChainNodeURL, "chain node url")
	pf := flag.String("p", configs.ExtensionProxyURL, "extension proxy url")
	instructionSenderF := flag.String("instructionSender", "", "instructionSender address")
	flag.Parse()

	instructionSenderAddress := common.HexToAddress(*instructionSenderF)

	testSupport, err := support.DefaultSupport(*af, *cf)
	if err != nil {
		fccutils.FatalWithCause(err)
	}

	// --- Generic: configure contract -----------------------------------------
	logger.Infof("Setting extension ID on instruction sender...")
	err = instrutils.SetExtensionId(testSupport, instructionSenderAddress)
	if err != nil {
		if strings.Contains(err.Error(), "already set") || strings.Contains(err.Error(), "Extension ID already set") {
			logger.Infof("Extension ID already set on contract, continuing")
		} else {
			logger.Errorf("setExtensionId failed: %s", err)
			fccutils.FatalWithCause(errors.Errorf(
				"setExtensionId failed — is the extension registered? Check that pre-build.sh completed successfully. Error: %s", err))
		}
	}

	// --- Test: GET_BALANCE for a pot nobody has deposited into yet ---
	//
	// This proves the full round trip — registry → proxy → TEE node → our
	// handler → polled result — without needing a RECORD_DEPOSIT, which would
	// require reimplementing eth-crypto-compatible ECIES encryption in Go for
	// a one-off test. The private-ledger decrypt path is exercised by the
	// frontend instead (it does the same encryption in the browser).
	var potId [32]byte
	if _, err := rand.Read(potId[:]); err != nil {
		fccutils.FatalWithCause(err)
	}
	deployer := crypto.PubkeyToAddress(testSupport.Prv.PublicKey)

	logger.Infof("Sending GET_BALANCE instruction for a fresh pot (expect balance 0)...")
	instructionId, _, err := instrutils.SendGetBalance(testSupport, instructionSenderAddress, potId)
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	logger.Infof("Instruction sent. ID: %s", instructionId.Hex())

	time.Sleep(5 * time.Second)

	err = verifyBalanceResult(*pf, instructionId, deployer)
	if err != nil {
		fccutils.FatalWithCause(err)
	}
	logger.Infof("Test passed: GET_BALANCE instruction processed successfully")

	logger.Infof("All tests passed.")
}

func verifyBalanceResult(proxyURL string, instructionId common.Hash, expectedMember common.Address) error {
	// --- Generic: poll proxy for result (do not modify) ---
	actionResponse, err := fccutils.ActionResult(proxyURL, instructionId)
	if err != nil {
		return err
	}
	actionResult := actionResponse.Result

	if actionResult.Status == 0 {
		return errors.Errorf("instruction processing failed: %s", actionResult.Log)
	}
	if actionResult.Status == 2 {
		return errors.New("instruction still pending after polling, expected completed")
	}

	if len(actionResult.Data) == 0 {
		return errors.New("expected response data but got none")
	}

	var resp getBalanceResponse
	err = json.Unmarshal(actionResult.Data, &resp)
	if err != nil {
		return errors.Errorf("failed to unmarshal response: %s", err)
	}

	if !strings.EqualFold(resp.Member, expectedMember.Hex()) {
		return errors.Errorf("expected member %s, got %s", expectedMember.Hex(), resp.Member)
	}
	if resp.Balance != "0" {
		return errors.Errorf("expected balance 0 for a fresh pot, got %s", resp.Balance)
	}

	logger.Infof("Response data: %+v", resp)

	return nil
}
