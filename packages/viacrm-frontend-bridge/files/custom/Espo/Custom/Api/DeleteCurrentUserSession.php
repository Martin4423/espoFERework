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

class DeleteCurrentUserSession implements Action
{
    public function __construct(
        private EntityManager $entityManager,
        private User $user,
    ) {}

    public function process(Request $request): Response
    {
        $id = $request->getRouteParam('id');
        if (!$id) {
            throw new NotFound();
        }

        /** @var ?AuthToken $token */
        $token = $this->entityManager->getEntityById(AuthToken::ENTITY_TYPE, $id);
        if (!$token || $token->getUserId() !== $this->user->getId()) {
            throw new NotFound();
        }

        $token->setIsActive(false);
        $this->entityManager->saveEntity($token);

        return ResponseComposer::json(['id' => $id, 'isActive' => false]);
    }
}
