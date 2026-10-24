<?php

namespace Espo\Custom\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Mail\ConfigDataProvider as EmailConfigDataProvider;
use Espo\Core\ORM\EntityManager;
use Espo\Core\Utils\Config;
use Espo\Entities\PasswordChangeRequest;
use Espo\Tools\UserSecurity\Password\ConfigProvider;

class GetPasswordRecoveryInfo implements Action
{
    public function __construct(
        private EntityManager $entityManager,
        private Config $config,
        private EmailConfigDataProvider $emailConfigDataProvider,
        private ConfigProvider $passwordConfigProvider,
    ) {}

    public function process(Request $request): Response
    {
        $requestId = $request->getRouteParam('id');
        $requestFound = null;

        if ($requestId) {
            $passwordChangeRequest = $this->entityManager
                ->getRDBRepositoryByClass(PasswordChangeRequest::class)
                ->where(['requestId' => $requestId])
                ->findOne();

            $requestFound = (bool) $passwordChangeRequest;
        }

        return ResponseComposer::json([
            'passwordRecoveryEnabled' => (bool) (
                ($this->emailConfigDataProvider->getSystemOutboundAddress() || $this->config->get('internalSmtpServer')) &&
                !$this->config->get('passwordRecoveryDisabled')
            ),
            'requestFound' => $requestFound,
            'strengthParams' => [
                'passwordStrengthLength' => $this->passwordConfigProvider->getStrengthLength(),
                'passwordStrengthLetterCount' => $this->passwordConfigProvider->getStrengthLetterCount(),
                'passwordStrengthNumberCount' => $this->passwordConfigProvider->getStrengthNumberCount(),
                'passwordStrengthBothCases' => $this->passwordConfigProvider->getStrengthBothCases(),
                'passwordStrengthSpecialCharacterCount' => $this->passwordConfigProvider->getStrengthSpecialCharacterCount(),
            ],
        ]);
    }
}
