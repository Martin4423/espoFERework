<?php

namespace Espo\Custom\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Exceptions\NotFound;
use Espo\Core\ORM\EntityManager;
use Espo\Entities\AuthToken;
use Espo\Entities\User;

class DeleteOtherCurrentUserSessions implements Action
{
    public function __construct(
        private EntityManager $entityManager,
        private User $user,
    ) {}

    public function process(Request $request): Response
    {
        $auth = $request->getHeader('Espo-Authorization');
        $decoded = $auth ? base64_decode($auth, true) : false;
        $parts = is_string($decoded) ? explode(':', $decoded, 2) : [];
        $currentToken = $parts[1] ?? null;

        if (!$currentToken) {
            throw new NotFound();
        }

        $repository = $this->entityManager->getRDBRepositoryByClass(AuthToken::class);
        $sessions = $repository
            ->where(['userId' => $this->user->getId(), 'isActive' => true])
            ->find();

        $currentSessionFound = false;
        foreach ($sessions as $session) {
            if (hash_equals($session->getToken(), $currentToken)) {
                $currentSessionFound = true;
                break;
            }
        }

        if (!$currentSessionFound) {
            throw new NotFound();
        }

        $revoked = 0;
        foreach ($sessions as $session) {
            if (hash_equals($session->getToken(), $currentToken)) {
                continue;
            }

            $session->setIsActive(false);
            $this->entityManager->saveEntity($session);
            $revoked++;
        }

        return ResponseComposer::json(['revokedCount' => $revoked]);
    }
}
