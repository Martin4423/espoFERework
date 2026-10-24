<?php

namespace Espo\Custom\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\ORM\EntityManager;
use Espo\Entities\AuthLogRecord;
use Espo\Entities\User;

class GetCurrentUserLoginHistory implements Action
{
    public function __construct(
        private EntityManager $entityManager,
        private User $user,
    ) {}

    public function process(Request $request): Response
    {
        $list = $this->entityManager
            ->getRDBRepositoryByClass(AuthLogRecord::class)
            ->where(['userId' => $this->user->getId()])
            ->order('createdAt', 'DESC')
            ->limit(0, 25)
            ->find();

        $events = [];
        foreach ($list as $record) {
            $events[] = [
                'id' => $record->getId(),
                'username' => $record->get('username'),
                'ipAddress' => $record->get('ipAddress'),
                'createdAt' => $record->get('createdAt'),
                'isDenied' => (bool) $record->get('isDenied'),
                'denialReason' => $record->get('denialReason'),
                'authenticationMethod' => $record->get('authenticationMethod'),
            ];
        }

        return ResponseComposer::json(['list' => $events]);
    }
}
