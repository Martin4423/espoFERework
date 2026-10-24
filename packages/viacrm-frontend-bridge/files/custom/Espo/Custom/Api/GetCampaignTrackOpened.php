<?php

namespace Espo\Custom\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\NotFound;
use Espo\Core\ORM\EntityManager;
use Espo\Entities\User;
use Espo\Modules\Crm\Entities\EmailQueueItem;
use Espo\Modules\Crm\Tools\Campaign\LogService;

class GetCampaignTrackOpened implements Action
{
    private const TRANSPARENT_PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pVQAAAAASUVORK5CYII=';

    public function __construct(
        private EntityManager $entityManager,
        private LogService $logService,
        private User $user,
    ) {}

    public function process(Request $request): Response
    {
        $id = $request->getRouteParam('id') ?? throw new BadRequest();
        $queueItem = $this->entityManager->getRDBRepositoryByClass(EmailQueueItem::class)->getById($id);

        if (!$queueItem) {
            throw new NotFound("Campaign tracking item not found.");
        }

        $target = $this->entityManager->getEntityById($queueItem->getTargetType(), $queueItem->getTargetId());
        $massEmail = $queueItem->getMassEmail();
        $campaign = $massEmail?->getCampaign();

        if ($target && $campaign && $this->user->isSystem()) {
            $this->logService->logOpened($campaign->getId(), $queueItem);
        }

        return ResponseComposer::empty()
            ->setHeader('Content-Type', 'image/png')
            ->setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
            ->writeBody((string) base64_decode(self::TRANSPARENT_PIXEL));
    }
}
