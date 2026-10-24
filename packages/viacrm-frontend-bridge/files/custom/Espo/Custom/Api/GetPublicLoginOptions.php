<?php

namespace Espo\Custom\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Authentication\Util\MethodProvider;
use Espo\Core\Utils\Config;
use Espo\Core\Utils\Metadata;

class GetPublicLoginOptions implements Action
{
    public function __construct(
        private Config $config,
        private Metadata $metadata,
        private MethodProvider $methodProvider,
    ) {}

    public function process(Request $request): Response
    {
        $method = $this->methodProvider->get();
        $login = $this->metadata->get(['authenticationMethods', $method, 'login']) ?? [];
        $handler = $login['handler'] ?? null;
        $fallback = $login['fallback'] ?? null;

        if ($fallback === null) {
            $fallbackParam = $login['fallbackConfigParam'] ?? null;
            $fallback = $fallbackParam ? (bool) $this->config->get($fallbackParam) : false;
        }

        return ResponseComposer::json([
            'oidc' => $handler === 'handlers/login/oidc',
            'fallback' => (bool) $fallback,
            'method' => $method,
        ]);
    }
}
