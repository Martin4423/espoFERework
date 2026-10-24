<?php

namespace Espo\Custom\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\ORM\EntityManager;
use Espo\Entities\AuthToken;
use Espo\Entities\User;

class GetCurrentUserSessions implements Action
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

        $list = $this->entityManager
            ->getRDBRepositoryByClass(AuthToken::class)
            ->where(['userId' => $this->user->getId(), 'isActive' => true])
            ->order('lastAccess', 'DESC')
            ->limit(0, 50)
            ->find();

        $sessions = [];
        foreach ($list as $token) {
            $sessions[] = [
                'id' => $token->getId(),
                'ipAddress' => $token->get('ipAddress'),
                'createdAt' => $token->get('createdAt'),
                'lastAccess' => $token->get('lastAccess'),
                'isCurrent' => $currentToken !== null && hash_equals($token->getToken(), $currentToken),
            ];
        }

        return ResponseComposer::json(['list' => $sessions]);
    }
}
